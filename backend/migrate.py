from pathlib import Path
from alembic import command
from alembic.config import Config


def main():
    config = Config()
    config.set_main_option("script_location", str(Path(__file__).parent / "alembic"))
    command.upgrade(config, "head")
    print("WAKA versioned schema migration complete")


if __name__ == "__main__":
    main()