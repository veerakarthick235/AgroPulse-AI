import os
import pymongo
from dotenv import load_dotenv

load_dotenv(override=True)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/agropulse")

try:
    client = pymongo.MongoClient(MONGO_URI)
    # Try to get default database, fallback to 'agropulse' if not present in URI
    db = client.get_default_database() if client.get_database().name else client['agropulse']
    print("MongoDB initialized successfully in database.py.")
except pymongo.errors.ConfigurationError:
    # This means no default database in URI
    db = client['agropulse']
    print("MongoDB initialized successfully with explicit db 'agropulse'.")
except Exception as e:
    print(f"Error initializing MongoDB: {e}")
    db = None
