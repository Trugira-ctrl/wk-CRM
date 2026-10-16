import csv
import asyncio
import io
import uuid
from datetime import timedelta
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from .common import normalize_email, today
from .config import ALLOWED_ORIGINS, COOKIE_SECURE, DEMO_MODE, ENVIRONMENT, SESSION_COOKIE
from .db import SessionLocal, pool_options
from .models import Branch, Plan, Session as LoginSession, User
from .security import create_session, session_user, token_digest, verify_password
from .serializers import branch_checkins_today, branch_json, member_json, plan_json, user_json, workspace
from .services import create_member, get_member, run_action
from .requests import JoinRequest, validated
from .reporting import payment_page
from .wallet import wallet_view, run_wallet_action

app = FastAPI(title="WAKA Phase 1 simulated operations API", version="1.0.0")
# Queue before entering FastAPI's synchronous worker pool. Otherwise session
# dependencies can hold every DB connection while endpoint workers wait for a
# thread, and new auth dependencies occupy the remaining threads waiting for DB.
db_admission = asyncio.Semaphore(max(1, min(12,
    pool_options.get("pool_size", 5) + pool_options.get("max_overflow", 10))))


@app.middleware("http")
async def bounded_database_requests(request: Request, call_next):
    try:
        await asyncio.wait_for(db_admission.acquire(), timeout=20)
    except asyncio.TimeoutError:
        return JSONResponse({"error": "busy", "detail": "Service is busy; please retry shortly"}, status_code=503)
    try:
        return await call_next(request)
    finally:
        db_admission.release()


def get_db():
    with SessionLocal() as db:
        yield db


def current_user(request: Request, db: Session = Depends(get_db)):
    user = session_user(db, request.cookies.get(SESSION_COOKIE))
    if not user:
        raise HTTPException(401, detail="Authentication required")
    db.commit()  # release authentication's read transaction before endpoint work
    return user


def set_cookie(response: Response, token: str):
    response.set_cookie(SESSION_COOKIE, token, max_age=7 * 86400, httponly=True,
                        secure=COOKIE_SECURE, samesite="lax", path="/")


@app.middleware("http")
async def validate_mutation_origin(request: Request, call_next):
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin")
        if ENVIRONMENT == "production":
            if origin not in ALLOWED_ORIGINS:
                return JSONResponse({"error": "forbidden_origin", "detail": "An approved request origin is required"}, status_code=403)
            return await call_next(request)
        if origin:
            origin_host = urlparse(origin).netloc.lower()
            allowed = {request.headers.get("host", "").lower()}
            forwarded = request.headers.get("x-forwarded-host", "")
            allowed.update(x.strip().lower() for x in forwarded.split(",") if x.strip())
            # Proxies may report a different port internally; matching hostname is sufficient.
            origin_name = origin_host.split(":")[0]
            allowed_names = {x.split(":")[0] for x in allowed}
            if origin_host not in allowed and origin_name not in allowed_names:
                return JSONResponse({"error": "forbidden_origin", "detail": "Mutation origin does not match this host"}, status_code=403)
    return await call_next(request)


@app.exception_handler(HTTPException)
async def http_error(_request, exc):
    detail = str(exc.detail)
    return JSONResponse({"error": detail.lower().replace(" ", "_")[:80], "detail": detail}, status_code=exc.status_code)


@app.exception_handler(IntegrityError)
async def integrity_error(_request, _exc):
    return JSONResponse({"error": "conflict", "detail": "A unique or relational constraint was violated"}, status_code=409)


@app.exception_handler(SQLAlchemyError)
async def database_error(_request, _exc):
    return JSONResponse({"error": "service_unavailable", "detail": "Service temporarily unavailable; please try again"},
                        status_code=503)


@app.exception_handler(RequestValidationError)
async def validation_error(_request, exc):
    first = exc.errors()[0] if exc.errors() else {}
    detail = first.get("msg", "Invalid request")
    return JSONResponse({"error": "invalid_request", "detail": detail}, status_code=400)


@app.get("/health")
@app.get("/api/healthz")
def health():
    return {"status": "ok"}


@app.get("/health/db")
@app.get("/api/health/db")
def database_health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok"}
    except SQLAlchemyError:
        raise HTTPException(503, detail="Database unavailable")


@app.get("/api/session")
def get_session(request: Request, db: Session = Depends(get_db)):
    user = session_user(db, request.cookies.get(SESSION_COOKIE))
    return {"user": user_json(user) if user else None, "demo_mode": DEMO_MODE}


@app.post("/api/login")
def login(body: dict, response: Response, db: Session = Depends(get_db)):
    try:
        email = normalize_email(body.get("email"))
    except HTTPException:
        raise HTTPException(401, detail="Invalid email or password")
    password = body.get("password")
    if not isinstance(password, str):
        raise HTTPException(400, detail="Password is required")
    user = db.scalar(select(User).where(User.email == email))
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(401, detail="Invalid email or password")
    if user.is_demo_seed and (not DEMO_MODE or ENVIRONMENT == "production"):
        raise HTTPException(403, detail="Seeded demo logins are disabled outside demo development")
    token = create_session(db, user); db.commit()
    set_cookie(response, token)
    return {"user": user_json(user), "demo_mode": DEMO_MODE}


@app.post("/api/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        session = db.scalar(select(LoginSession).where(LoginSession.token_hash == token_digest(token)))
        if session:
            db.delete(session); db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/", secure=COOKIE_SECURE, httponly=True, samesite="lax")
    return {"ok": True, "message": "Signed out"}


@app.get("/api/public")
def public_data(db: Session = Depends(get_db)):
    plans = db.scalars(select(Plan).order_by(Plan.id)).all()
    branches = db.scalars(select(Branch).order_by(Branch.id)).all()
    counts = branch_checkins_today(db)
    return {"plans": [plan_json(p) for p in plans], "branches": [branch_json(db, b, counts) for b in branches]}


@app.post("/api/join")
def join(body: dict, response: Response, db: Session = Depends(get_db)):
    body = validated(JoinRequest, body).model_dump()
    if not body.get("password"):
        raise HTTPException(400, detail="Password is required to create a member login")
    try:
        member, user = create_member(db, {**body, "record_payment": True}, record_default=True, create_login=True)
        from .services import audit
        db.info["actor_id"] = user.id
        audit(db, "MEMBER_REGISTERED", f"Public registration: member_id={member.id}; simulated activation")
        token = create_session(db, user)
        db.commit()
    except Exception:
        db.rollback()
        raise
    set_cookie(response, token)
    return {"ok": True, "message": "Membership created with simulated payment",
            "member": member_json(get_member(db, member.id))}


@app.get("/api/workspace")
def get_workspace(user: User = Depends(current_user), db: Session = Depends(get_db)):
    try:
        return workspace(db, user)
    finally:
        db.rollback()  # result is plain data; don't hold a connection during JSON encoding


@app.get("/api/payments")
def payments(page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
             user: User = Depends(current_user), db: Session = Depends(get_db)):
    return payment_page(db, user, page, page_size)


@app.post("/api/actions")
def actions(body: dict, response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    try:
        result = run_action(db, user, body)
    except Exception:
        db.rollback()
        raise
    token = result.pop("_session_token", None)
    if token:
        set_cookie(response, token)
    return result


@app.get("/api/wallet")
def get_wallet(member_id: int = Query(..., gt=0), user: User = Depends(current_user), db: Session = Depends(get_db)):
    try:
        return wallet_view(db, user, member_id)
    finally:
        db.rollback()


@app.post("/api/wallet/actions")
def wallet_actions(body: dict, user: User = Depends(current_user), db: Session = Depends(get_db)):
    try:
        return run_wallet_action(db, user, body)
    except Exception:
        db.rollback()
        raise


@app.get("/api/sample-export.csv", response_class=PlainTextResponse)
def sample_export(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role != "ADMIN":
        raise HTTPException(403, detail="Administrator role required")
    day = today()
    batch = uuid.uuid4().hex
    plans = db.scalars(select(Plan).order_by(Plan.id)).all()
    if not plans:
        raise HTTPException(409, detail="Create a membership plan before downloading the sample")
    fields = ["source_record_id", "full_name", "email", "phone", "plan", "start_date", "end_date", "branch_id"]
    names = [
        ("FB-1001","Diane Ishimwe","diane.ishimwe@example.test","+250788200101","Monthly",2),
        ("FB-1002","Claude Niyonzima","claude.niyonzima@example.test","+250788200102","Quarterly",1),
        ("FB-1003","Grace Uwamahoro","grace.uwamahoro@example.test","+250788200103","Annual",3),
        ("FB-1004","Samuel Rukundo","samuel.rukundo@example.test","+250788200104","Monthly",2),
        ("FB-1005","Divine Mutoni","divine.mutoni@example.test","+250788200105","Quarterly",1),
        ("FB-1006","Olivier Bizimana","olivier.bizimana@example.test","+250788200106","Annual",3),
        ("FB-1007","Sandrine Umutesi","sandrine.umutesi@example.test","+250788200107","Monthly",2),
        ("FB-1008","Jean Bosco Murenzi","jean.murenzi@example.test","+250788200108","Quarterly",1),
        ("FB-1009","Nadine Nyirahabimana","nadine.nyira@example.test","","Monthly",2),
        ("FB-1010","Fabrice Karemera","diane.ishimwe@example.test","+250788200110","Legacy Gold",3),
    ]
    output = io.StringIO(); writer = csv.DictWriter(output, fieldnames=fields); writer.writeheader()
    durations = {"Monthly":30, "Quarterly":90, "Annual":365, "Legacy Gold":30}
    for index, (sid, name, email, phone, plan, branch) in enumerate(names):
        sid = f"{batch}-{sid}"
        email = f"{batch}.{email}"
        duration = durations[plan]
        if index != 9:
            selected = plans[index % len(plans)]
            plan, duration = selected.name, selected.duration_days
        else:
            plan = f"Unknown sample plan {batch}"
        start = day - timedelta(days=index + 1)
        writer.writerow({"source_record_id":sid, "full_name":name, "email":email, "phone":phone,
                         "plan":plan, "start_date":start.isoformat(),
                         "end_date":(start + timedelta(days=duration)).isoformat(), "branch_id":branch})
    return PlainTextResponse(output.getvalue(), media_type="text/csv",
                             headers={"Content-Disposition": 'attachment; filename="fitbase_sample_export.csv"'})
