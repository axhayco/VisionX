import os
from dotenv import load_dotenv
from groq import Groq

# Load env variables
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

groq_key = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=groq_key)

print("Fetching active models from Groq API...")
try:
    models = client.models.list()
    # Print models containing 'vision' or other relevant keywords
    for model in models.data:
        print(f"- ID: {model.id} (Created by: {model.owned_by})")
except Exception as e:
    print(f"Error: {e}")
