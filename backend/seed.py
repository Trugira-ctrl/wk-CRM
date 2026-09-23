import argparse

from .db import SessionLocal
from .seed_data import seed


def main():
    parser = argparse.ArgumentParser(description="Seed fictional WAKA POC data")
    parser.add_argument("--reset", action="store_true", help="delete and recreate WAKA-owned data")
    args = parser.parse_args()
    with SessionLocal() as db:
        changed = seed(db, reset=args.reset)
    print("WAKA demo data seeded" if changed else "Database is not empty; seed skipped (use --reset explicitly)")


if __name__ == "__main__":
    main()