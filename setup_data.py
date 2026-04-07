"""
Download PaySim dataset from Kaggle.
Usage: python setup_data.py

Requires Kaggle credentials either via:
  - ~/.kaggle/kaggle.json
  - Environment vars KAGGLE_USERNAME and KAGGLE_KEY in .env
"""
import os
import glob
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


def download_paysim():
    # Set kaggle env vars if provided in .env
    username = os.getenv("KAGGLE_USERNAME")
    key = os.getenv("KAGGLE_KEY")
    if username and key:
        os.environ["KAGGLE_USERNAME"] = username
        os.environ["KAGGLE_KEY"] = key

    import kaggle  # noqa: import after env setup

    data_dir = Path(__file__).parent / "data"
    data_dir.mkdir(exist_ok=True)

    # Check if already downloaded
    existing = glob.glob(str(data_dir / "PS_*.csv"))
    if existing:
        print(f"PaySim CSV already present: {existing[0]}")
        return existing[0]

    print("Downloading PaySim dataset from Kaggle (ealaxi/paysim1)...")
    print("This is ~470MB and may take a few minutes.")
    kaggle.api.authenticate()
    kaggle.api.dataset_download_files("ealaxi/paysim1", path=str(data_dir), unzip=True)

    csv_files = glob.glob(str(data_dir / "PS_*.csv"))
    if not csv_files:
        raise FileNotFoundError("Download succeeded but no PS_*.csv found in data/")

    print(f"Downloaded: {csv_files[0]}")
    return csv_files[0]


if __name__ == "__main__":
    path = download_paysim()
    print(f"\nDataset ready at: {path}")
    print("Run the API server with: ./start.sh")
