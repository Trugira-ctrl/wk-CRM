from .db import Base, engine
from . import models  # noqa: F401


def main():
    Base.metadata.create_all(engine)
    print("WAKA schema migration complete")


if __name__ == "__main__":
    main()