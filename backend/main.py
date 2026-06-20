import os
import base64
import json
import requests
from flask import Flask, request, jsonify, render_template, url_for
from flask_cors import CORS
import cloudinary
import cloudinary.uploader
import pymongo
from datetime import datetime, timedelta
from dotenv import load_dotenv
import google.generativeai as genai
from googleapiclient.discovery import build


load_dotenv(override=True)

app = Flask(__name__)
CORS(app, origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000"
])

# ─── Register Blueprints ────────────────────────────────────────────────────
try:
    from routes.auth import auth_bp
    from routes.seller import seller_bp
    from routes.buyer import buyer_bp
    from routes.admin import admin_bp
    from routes.delivery import delivery_bp
    from routes.payment import payment_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(seller_bp)
    app.register_blueprint(buyer_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(delivery_bp)
    app.register_blueprint(payment_bp)
    print("All API blueprints registered successfully.")
except ImportError as e:
    print(f"WARNING: Could not import blueprints: {e}")


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")
DATA_GOV_API_KEY = os.getenv("DATA_GOV_API_KEY")
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/agropulse")
GOOGLE_CSE_API_KEY = os.getenv("GOOGLE_CSE_API_KEY")
GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID")


try:
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET"),
        secure=True
    )
    print("Cloudinary configured successfully.")
except Exception as e:
    print(f"Error configuring Cloudinary: {e}")

try:
    mongo_client = pymongo.MongoClient(MONGO_URI)
    db = mongo_client.get_database() # Uses database from connection string, or default if not specified
    print("MongoDB initialized successfully.")
except Exception as e:
    print(f"Error initializing MongoDB: {e}")
    db = None

try:
    with open('prices.json', 'r', encoding='utf-8') as f:
        all_prices_data = json.load(f)
    print("prices.json loaded successfully.")
except FileNotFoundError:
    all_prices_data = None
    print("WARNING: prices.json not found. The /prices endpoint might have reduced functionality.")
except json.JSONDecodeError:
    all_prices_data = None
    print("ERROR: Could not decode prices.json. Check syntax.")

TEXT_MODEL = 'models/gemini-2.5-flash'
VISION_MODEL = genai.GenerativeModel('models/gemini-2.5-flash')

def get_image_url_from_google(query):
    """Searches for an image using Google Custom Search API and returns the first result."""
    try:
        if not GOOGLE_CSE_API_KEY or not GOOGLE_CSE_ID:
            print("WARNING: Google CSE API Key or ID is not set. Cannot search for image.")
            return None

        service = build("customsearch", "v1", developerKey=GOOGLE_CSE_API_KEY)
        res = service.cse().list(
            q=query,
            cx=GOOGLE_CSE_ID,
            searchType='image',
            num=1,
            safe='high'
        ).execute()

        if 'items' in res and len(res['items']) > 0:
            return res['items'][0]['link']
        else:
            return None
    except Exception as e:
        print(f"ERROR during Google Image Search: {e}")
        return None

def get_price_info_from_google(vegetable, location):
    """Searches for vegetable prices using Google Custom Search API and returns snippets."""
    try:
        if not GOOGLE_CSE_API_KEY or not GOOGLE_CSE_ID:
            print("WARNING: Google CSE API Key or ID is not set. Cannot search for price info.")
            return None

        service = build("customsearch", "v1", developerKey=GOOGLE_CSE_API_KEY)
        query = f"current market price of {vegetable} in {location} India today"
        res = service.cse().list(
            q=query,
            cx=GOOGLE_CSE_ID,
            num=3
        ).execute()

        snippets = []
        if 'items' in res:
            for item in res['items']:
                snippets.append(item.get('snippet', ''))

        return " | ".join(snippets) if snippets else None
    except Exception as e:
        print(f"ERROR during Google Price Search: {e}")
        return None


def extract_json(text):
    """Extracts a JSON object from a string that might contain markdown backticks or extra text."""
    try:
        # Look for the first '{' and last '}'
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            json_str = text[start:end+1]
            return json.loads(json_str)
        return json.loads(text)  # Fallback to direct parse
    except Exception as e:
        print(f"JSON EXTRACTION ERROR: {e}. Text: {text[:200]}...")
        raise e

@app.route("/")
def index():
    """Renders the main page."""
    return jsonify({"status": "AI Agro Assistant Backend is running!", "version": "2.0"})

@app.route("/ask-agro-assistant", methods=["POST"])
def ask_agro_assistant():
    """Handles chatbot queries using the Gemini API."""
    try:
        data = request.get_json()
        user_question = data.get("question", "").strip()

        if not user_question:
            return jsonify({"error": "No question provided."}), 400

        system_prompt = """
        You are 'Agro Assistant', a friendly and helpful AI chatbot for a web application designed for farmers.
        Your purpose is to answer user questions about the features of the Agro Assistant application.
        Your answers should be concise, helpful, and in a conversational tone.

        Here is a summary of the application's features:
        - *Crop Disease Prediction*: Users can upload an image of a crop leaf, and the AI will identify if it has a disease and suggest remedies.
        - *Weather Forecast*: Provides real-time weather updates for any city or the user's current location. It also shows weather in nearby major cities.
        - *Market Prices*: Tracks the latest prices of vegetables in local markets like Coimbatore and Salem.
        - *AI Planner*: Gives intelligent suggestions for crops to plant based on land area and season (Kharif, Rabi, Summer). It provides estimated costs and farming tips.
        - *Buy/Sell Marketplace*: A platform where farmers can list their products (vegetables, fruits, grains) for sale, and buyers can browse and purchase them.
        - *Agri News*: Shows the latest agricultural news from India and around the world.
        - *Agri Loan Application*: A step-by-step form that allows farmers to apply for loans by uploading PAN Card, bank statement, and personal details. After checking eligibility, users can submit a final application. The interest rate is 1% per annum with monthly repayment terms.
        - *About Us*: Information about the app's mission and the development team (Lokesh, Sarjan, Nishanth, Karthick). Our Mentors ...Dr.P.Thangavelu (Principal) and Dr.R.Senthil Kumar (HOD)

        Based on this information, please answer the user's question. If the question is unrelated to the Agro Assistant application or its features, politely state that you can only answer questions about the application.
        """

        if not GEMINI_API_KEY:
            return jsonify({"error": "Gemini API Key is missing in .env file."}), 500

        model = genai.GenerativeModel(TEXT_MODEL)
        response = model.generate_content(
            f"System Prompt: {system_prompt}\n\nUser Question: {user_question}"
        )

        result_text = response.text
        return jsonify({"answer": result_text})

    except Exception as e:
        print(f"CHATBOT ERROR: {e}")
        return jsonify({"error": f"An unexpected error occurred: {e}"}), 500

@app.route("/voice-intelligence", methods=["POST"])
def voice_intelligence():
    """Processes voice transcripts using Gemini for intent parsing and AI responses."""
    try:
        data = request.get_json()
        transcript = data.get("transcript", "").strip()

        if not transcript:
            return jsonify({"error": "No transcript provided."}), 400

        # Local Regex Fallback for common actions
        def get_fallback_intent(txt):
            txt = txt.lower()
            if any(k in txt for k in ["weather", "வானிலை", "மழை", "forecast"]):
                city_match = txt.split("in")[-1].strip() if "in" in txt else ""
                return {"type": "command", "action": "weather", "params": {"city": city_match}, "answer": "Opening weather...", "speech": "Sure, let me check the weather."}
            if any(k in txt for k in ["price", "விலை", "market", "market prices"]):
                return {"type": "command", "action": "price", "answer": "Checking market prices...", "speech": "Sure, checking the latest commodity prices."}
            if any(k in txt for k in ["planner", "திட்டம்", "plan", "guide"]):
                return {"type": "command", "action": "planner", "answer": "Opening AI Planner...", "speech": "Switching to the farming planner."}
            if any(k in txt for k in ["scan", "disease", "நோய்", "leaf"]):
                return {"type": "command", "action": "disease", "answer": "Opening leaf scanner...", "speech": "Ready to scan for crop diseases."}
            if any(k in txt for k in ["sell", "buy", "marketplace", "market"]):
                return {"type": "command", "action": "buysell", "answer": "Opening marketplace...", "speech": "Taking you to the buy and sell section."}
            return None

        fallback = get_fallback_intent(transcript)

        system_prompt = """
        You are the 'Agro Intelligence' engine. Your job is to parse the user's voice transcript (which could be in English or Tamil) and determine if it's a 'command' to navigate the app or a 'question' to be answered.

        **App Commands:**
        - weather: Show weather results. Requires 'city'.
        - disease: Navigate to Crop Guide (scan leaf).
        - price: Navigate to Market Prices. Requires 'vegetable' and 'location'.
        - planner: Navigate to AI Planner.
        - news: Navigate to Agri News.
        - loan: Navigate to Agri Loan.

        **Response Format:**
        Your response must be a single block of JSON.
        {
            "type": "command" or "answer",
            "action": "weather", "disease", "price", "planner", "news", or "loan" (only if type is command),
            "params": {"city": "...", "vegetable": "...", "location": "..."} (only if command needs them),
            "answer": "Your concise AI response here" (if type is answer or if you want to 'speak' back the action),
            "speech": "A natural sounding sentence to be spoken via TTS"
        }

        **Tamil Keywords Examples:**
        - 'வானிலை' (Vannilai - Weather)
        - 'மழை' (Mazhai - Rain/Weather)
        - 'விலை' (Vilai - Price)
        - 'திட்டம்' (Thittam - Planner)
        - 'நோய்' (Noi - Disease)
        """

        if not GEMINI_API_KEY:
            if fallback:
                return jsonify(fallback)
            return jsonify({"type": "answer", "answer": "Gemini API Key missing in .env.", "speech": "I am missing the Gemini API key."}), 500

        try:
            model = genai.GenerativeModel(TEXT_MODEL)
            response = model.generate_content(
                f"System Prompt: {system_prompt}\n\nUser Transcript: {transcript}"
            )
            result_json = response.text
            return jsonify(extract_json(result_json))
        except Exception as e:
            print(f"Gemini Fetch Exception: {e}")
            if fallback:
                fallback["answer"] = "(Safe Mode) " + fallback["answer"]
                return jsonify(fallback), 200
            return jsonify({"type": "answer", "answer": "AI Engine busy. Using basic commands.", "speech": "My AI brain is busy, using basic navigation."}), 500

    except Exception as e:
        print(f"VOICE INTEL ERROR: {e}")
        return jsonify({"type": "answer", "answer": f"Something went wrong while connecting to Gemini: {str(e)}", "speech": "I am having trouble connecting to my brain right now."}), 500

@app.route("/explain-results", methods=["POST"])
def explain_results():
    """Generates a natural language explanation for specific data (weather, prices, etc.)"""
    try:
        data = request.get_json()
        context_type = data.get("type", "general")
        raw_data = data.get("data", {})

        system_prompt = f"""
        You are the 'Agro Speaker'. Your task is to provide a friendly, detailed spoken summary of the provided {context_type} data.
        If the data is in English, you can summarize in English but keep it natural.
        If the user context (Tamil) is detected, provide the explanation in Tamil (Tanglish or pure Tamil is fine, but make it very clear for a farmer).
        The goal is to explain the most important details (e.g., temperature, rain chances, or market prices) out loud.
        """

        if not GEMINI_API_KEY:
            return jsonify({"explanation": f"Here is the {context_type} information. (AI summary unavailable)"})

        try:
            model = genai.GenerativeModel(TEXT_MODEL)
            response = model.generate_content(
                f"System Prompt: {system_prompt}\n\nRaw Data: {json.dumps(raw_data)}"
            )
            explanation = response.text
            return jsonify({"explanation": explanation})
        except Exception as e:
            print(f"Explain Results Exception: {e}")
            return jsonify({"explanation": f"I've updated the {context_type} for you. Look at the screen for more info."})

    except Exception as e:
        return jsonify({"explanation": "I'm sorry, I couldn't summarize the results right now."}), 500

@app.route("/upload-item-image", methods=["POST"])
def upload_item_image():
    """Handles image uploads for marketplace items to Cloudinary."""
    if 'item_image' not in request.files:
        return jsonify({"error": "No 'item_image' file part"}), 400
    file_to_upload = request.files['item_image']
    if file_to_upload.filename == '':
        return jsonify({"error": "No file selected"}), 400
    try:
        upload_result = cloudinary.uploader.upload(file_to_upload, folder="agri_assistant_items")
        return jsonify({"imageUrl": upload_result.get('secure_url')})
    except Exception as e:
        print(f"CLOUDINARY UPLOAD ERROR: {e}")
        return jsonify({"error": f"Failed to upload image: {e}"}), 500

@app.route('/upload-profile-image', methods=['POST'])
def upload_profile_image():
    """Handles profile image uploads to Cloudinary with debugging."""
    print("INFO: Received request for /upload-profile-image")
    if 'profile_image' not in request.files:
        print("ERROR: 'profile_image' not in request.files")
        return jsonify({'error': 'No file part in the request'}), 400

    file = request.files['profile_image']

    if file.filename == '':
        print("ERROR: No file selected by user")
        return jsonify({'error': 'No selected file'}), 400

    if file:
        try:
            print("INFO: Uploading file to Cloudinary...")
            upload_result = cloudinary.uploader.upload(file, folder="agro_assistant_profiles")
            secure_url = upload_result.get('secure_url')
            print(f"SUCCESS: Cloudinary URL is {secure_url}")
            return jsonify({'message': 'Image uploaded successfully', 'secure_url': secure_url}), 200
        except Exception as e:
            print(f"CLOUDINARY PROFILE UPLOAD ERROR: {e}")
            return jsonify({'error': str(e)}), 500

    return jsonify({'error': 'An unknown error occurred'}), 500

@app.route('/add-item', methods=['POST'])
def add_item():
    """Adds a new product item to the MongoDB database."""
    if db is None:
        return jsonify({"error": "Database not initialized"}), 500
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data received in request"}), 400
        result = db.products.insert_one(data)
        return jsonify({"success": True, "message": "Item added successfully", "id": str(result.inserted_id)}), 201
    except Exception as e:
        print(f"ERROR in /add-item endpoint: {e}")
        return jsonify({"error": f"Failed to add item: {e}"}), 500

@app.route('/get-items', methods=['GET'])
def get_items():
    """Retrieves all product items from the MongoDB database."""
    if db is None:
        return jsonify({"error": "Database not initialized"}), 500
    try:
        products_cursor = db.products.find().limit(100)
        products_list = []
        for doc in products_cursor:
            doc['id'] = str(doc.pop('_id'))
            products_list.append(doc)
        return jsonify(products_list)
    except Exception as e:
        return jsonify({"error": f"Failed to get items: {e}"}), 500

@app.route("/agri-news", methods=["GET"])
def agri_news():
    if not NEWS_API_KEY:
        return jsonify({"error": "News API key is not configured."}), 500

    search_query = "agriculture OR farming OR farmers OR crops OR monsoon"
    
    url = (f"https://gnews.io/api/v4/search?"
           f"q={search_query}"
           f"&lang=en&country=in&max=20"
           f"&apikey={NEWS_API_KEY}")

    try:
        response = requests.get(url)
        response.raise_for_status()
        news_data = response.json()
        filtered_articles = [article for article in news_data.get("articles", []) if article.get("title") != "[Removed]"]
        return jsonify({"articles": filtered_articles[:20]})
    except requests.exceptions.RequestException as e:
        print(f"NEWS API ERROR: {e}")
        # Fallback mock data when API limit is reached
        fallback_news = [
            {"title": "Government announces new subsidy for organic fertilizers", "description": "A new initiative to promote organic farming across major states in India.", "source": {"name": "Agri Ministry"}, "publishedAt": "2026-06-20T10:00:00Z", "urlToImage": ""},
            {"title": "Monsoon expected to arrive early this year", "description": "Meteorological department predicts favorable conditions for Kharif crops.", "source": {"name": "Weather Bureau"}, "publishedAt": "2026-06-19T08:30:00Z", "urlToImage": ""},
            {"title": "Farmers adopting drone technology for pesticide spraying", "description": "How drones are reducing costs and improving efficiency in modern Indian agriculture.", "source": {"name": "Tech Farming Daily"}, "publishedAt": "2026-06-18T14:15:00Z", "urlToImage": ""}
        ]
        return jsonify({"articles": fallback_news})
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred: {e}"}), 500

@app.route("/predict", methods=["POST"])
def predict():
    """Analyzes a leaf image and returns a comprehensive farming guide."""
    if 'leaf' not in request.files:
        return jsonify({"error": "No 'leaf' file part in the request"}), 400

    file = request.files['leaf']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    source = request.form.get("source", "upload")
    is_brief = request.form.get("brief", "false").lower() == "true"

    try:
        image_bytes = file.read()
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        prompt_text = f"""
        You are an advanced AI Crop Disease Prediction Engine.
        Analyze the provided leaf image and generate a structured, farmer-friendly diagnosis report.

        { "SOURCE: Analyzed using live camera image" if source == "camera" else "" }

        GENERAL RULES:
        - Output must be clean, readable plain text.
        - NO JSON, no markdown symbols (no asterisks, no hashes, no backticks).
        - Use simple, professional, and practical language.
        - Default language is English.
        - Be short, sweet, and confident.
        - End with: "This problem is common and controllable. Timely action will protect your crop."

        { "MODE: BRIEF MODE. Show ONLY: Disease Name, Severity, What to Do Today, Medicine Name." if is_brief else "MODE: FULL ANALYSIS" }

        OUTPUT STRUCTURE (Use these exact headings in order):

        CROP IDENTIFICATION
        - Crop name
        - Confidence: High / Medium / Low

        LEAF CONDITION
        - Healthy / Disease Detected / Pest Attack / Nutrient Deficiency

        DISEASE ANALYSIS
        - Disease name
        - Category: Fungal / Bacterial / Viral / Pest / Nutrient
        - Stage: Early / Moderate / Severe

        PRIORITY STATUS
        🟢 Normal – no action needed (Use only if Healthy)
        🟡 Watch – monitor closely (Use for Early stage or minor issues)
        🔴 Urgent – treat immediately (Use for Moderate/Severe or high risk)

        WHY THIS PROBLEM OCCURRED
        - Briefly explain (Weather, Watering, Soil, or Pest reason).

        KEY ACTION BLOCK
        Disease Name:
        Severity:
        What to Do Today:
        Medicine Name:

        TREATMENT GUIDANCE
        Organic Treatment:
        - Remedy and Dosage.
        Chemical Treatment:
        - Indian medicine name, Dosage, and Spray interval.

        DO NOT DO
        - Common mistakes to avoid.

        RECOVERY & PREVENTION
        - Expected recovery time and signs of improvement.
        - Simple prevention tips.

        FINAL SHORT ADVICE
        - 1–2 sentences of reassurance.
        """

        response = VISION_MODEL.generate_content([
            prompt_text,
            {"mime_type": "image/jpeg", "data": image_bytes}
        ])

        prediction_report_text = response.text
        return jsonify({"prediction_text": prediction_report_text})

    except Exception as e:
        print(f"PREDICTION ERROR: {e}")
        if "429" in str(e) or "ResourceExhausted" in str(type(e).__name__) or "exceeded your current quota" in str(e):
             return jsonify({"prediction_text": "CROP IDENTIFICATION\n- Crop name: Mock Crop (API Limit)\n- Confidence: High\n\nLEAF CONDITION\n- Healthy\n\nDISEASE ANALYSIS\n- Disease name: None (API Limit Reached)\n- Category: None\n- Stage: None\n\nPRIORITY STATUS\n🟡 Watch – monitor closely\n\nWHY THIS PROBLEM OCCURRED\n- The AI API free tier rate limit was exceeded. Please wait 60 seconds and try again.\n\nKEY ACTION BLOCK\nDisease Name: API Quota Limit\nSeverity: Moderate\nWhat to Do Today: Wait 60 seconds and try again.\nMedicine Name: None\n\nTREATMENT GUIDANCE\nOrganic Treatment:\n- Wait a minute.\nChemical Treatment:\n- Upgrade to a paid API key.\n\nDO NOT DO\n- Do not continuously hit the submit button.\n\nRECOVERY & PREVENTION\n- Expected recovery time is 1 minute.\n- Upgrade API limits to prevent this.\n\nFINAL SHORT ADVICE\n- This problem is common and controllable. Timely action will protect your crop."})
        return jsonify({"error": f"An unexpected error occurred on the server: {e}"}), 500

@app.route("/translate-report", methods=["POST"])
def translate_report():
    """Translates the analysis report text into the target language."""
    try:
        data = request.get_json()
        text = data.get("text", "")
        target_lang = data.get("language", "English")

        if not text:
            return jsonify({"error": "No text provided"}), 400

        prompt = f"""
        Translate the following Crop Disease Analysis report into {target_lang}.
        Maintain the "Govt agriculture style" and farmer-friendly tone.
        Ensure all technical terms are explained simply.
        Do not change the meaning or the structure of the report.
        Keep the original headings but translated.
        Output only the translated text, no other comments.

        Report Text:
        {text}
        """

        model = genai.GenerativeModel(TEXT_MODEL)
        response = model.generate_content(prompt)
        translated_text = response.text
        return jsonify({"translated_text": translated_text})

    except Exception as e:
        print(f"TRANSLATION ERROR: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/ask-leaf-followup", methods=["POST"])
def ask_leaf_followup():
    """Handles follow-up questions related to the analyzed leaf."""
    try:
        data = request.get_json()
        question = data.get("question", "")
        report_context = data.get("report", "")

        if not question or not report_context:
            return jsonify({"error": "Missing question or report context"}), 400

        prompt = f"""
        The user has a follow-up question about their plant which was just analyzed.
        Original Analysis:
        {report_context}

        User Question:
        {question}

        RULES:
        - Answer ONLY related to this leaf & original result.
        - Keep answers short and practical.
        - Do not repeat the full report.
        - Be supportive and clear.
        - If the question is unrelated, politely redirect to the report.
        """

        model = genai.GenerativeModel(TEXT_MODEL)
        response = model.generate_content(prompt)
        answer = response.text
        return jsonify({"answer": answer})

    except Exception as e:
        print(f"FOLLOWUP ERROR: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/weather", methods=["GET"])
def weather():
    """Fetches comprehensive weather data from OpenWeatherMap OneCall API."""
    lat = request.args.get("lat")
    lon = request.args.get("lon")
    city_name_query = request.args.get("city")

    if not OPENWEATHER_API_KEY:
        return jsonify({"error": "Weather API key not configured"}), 500

    final_city_name = city_name_query

    try:
        if city_name_query:
            geo_url = f"http://api.openweathermap.org/geo/1.0/direct?q={city_name_query}&limit=1&appid={OPENWEATHER_API_KEY}"
            geo_response = requests.get(geo_url)
            geo_response.raise_for_status()
            geo_data = geo_response.json()
            if not geo_data:
                return jsonify({"error": f"City '{city_name_query}' not found. Please check spelling."}), 404
            lat = geo_data[0]['lat']
            lon = geo_data[0]['lon']

        elif lat and lon:
            reverse_geo_url = f"http://api.openweathermap.org/geo/1.0/reverse?lat={lat}&lon={lon}&limit=1&appid={OPENWEATHER_API_KEY}"
            reverse_geo_response = requests.get(reverse_geo_url)
            reverse_geo_response.raise_for_status()
            reverse_geo_data = reverse_geo_response.json()
            if reverse_geo_data:
                loc = reverse_geo_data[0]
                final_city_name = f"{loc.get('name', 'Unknown')}, {loc.get('state', '')} {loc.get('country', '')}".strip(', ')

        if not lat or not lon:
            return jsonify({"error": "City name or latitude/longitude are required"}), 400

        # Try OneCall 3.0 first (Modern/Detailed)
        try:
            one_call_url = f"https://api.openweathermap.org/data/3.0/onecall?lat={lat}&lon={lon}&exclude=minutely&units=metric&appid={OPENWEATHER_API_KEY}"
            weather_response = requests.get(one_call_url, timeout=10)
            weather_response.raise_for_status()
            weather_data = weather_response.json()
        except Exception as e:
            print(f"OneCall 3.0 failed: {e}. Falling back to 2.5 API...")
            current_url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&units=metric&appid={OPENWEATHER_API_KEY}"
            forecast_url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&units=metric&appid={OPENWEATHER_API_KEY}"

            curr_res = requests.get(current_url, timeout=10)
            curr_res.raise_for_status()
            curr_data = curr_res.json()

            fore_res = requests.get(forecast_url, timeout=10)
            fore_res.raise_for_status()
            fore_data = fore_res.json()

            weather_data = {
                "lat": lat, "lon": lon,
                "timezone": curr_data.get("name", "Unknown"),
                "current": {
                    "dt": curr_data["dt"],
                    "temp": curr_data["main"]["temp"],
                    "feels_like": curr_data["main"]["feels_like"],
                    "humidity": curr_data["main"]["humidity"],
                    "pressure": curr_data["main"]["pressure"],
                    "weather": curr_data["weather"],
                    "wind_speed": curr_data["wind"]["speed"],
                    "wind_deg": curr_data["wind"]["deg"],
                    "sunrise": curr_data["sys"]["sunrise"],
                    "sunset": curr_data["sys"]["sunset"],
                    "visibility": curr_data.get("visibility", 10000),
                    "uvi": 0
                },
                "hourly": [{"dt": i["dt"], "temp": i["main"]["temp"], "weather": i["weather"]} for i in fore_data["list"][:24]],
                "daily": [{"dt": i["dt"], "temp": {"day": i["main"]["temp"], "night": i["main"]["temp"] - 5}, "weather": i["weather"]} for i in fore_data["list"][::8]]
            }

        # Fetch air pollution data
        try:
            air_pollution_url = f"http://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}"
            air_response = requests.get(air_pollution_url, timeout=5)
            air_response.raise_for_status()
            air_data = air_response.json()
            weather_data['air_quality'] = air_data.get('list', [{}])[0]
        except Exception as ae:
            print(f"Air pollution fetch failed: {ae}")
            weather_data['air_quality'] = {"main": {"aqi": "N/A"}}

        weather_data['city_name'] = final_city_name or weather_data.get('timezone', 'Unknown').split('/')[-1].replace('_', ' ')
        weather_data['lat'] = lat
        weather_data['lon'] = lon

        current_hour = datetime.now().hour
        is_night = current_hour < 6 or current_hour > 18

        def get_moon_phase(d):
            diff = d - datetime(2001, 1, 1)
            days = diff.days + diff.seconds / 86400.0
            lunations = 0.20439731 + (days * 0.03386319269)
            return lunations % 1.0

        moon_phase_val = get_moon_phase(datetime.now())
        moon_phase_name = "New Moon" if moon_phase_val < 0.06 or moon_phase_val > 0.94 else \
                          "Waxing Crescent" if moon_phase_val < 0.25 else \
                          "First Quarter" if moon_phase_val < 0.31 else \
                          "Waxing Gibbous" if moon_phase_val < 0.5 else \
                          "Full Moon" if moon_phase_val < 0.56 else \
                          "Waning Gibbous" if moon_phase_val < 0.75 else \
                          "Last Quarter" if moon_phase_val < 0.81 else "Waning Crescent"

        humidity = weather_data['current'].get('humidity', 0)
        temp = weather_data['current'].get('temp', 0)
        dew_point = weather_data['current'].get('dew_point', temp - ((100 - humidity) / 5))
        visibility = weather_data['current'].get('visibility', 10000) / 1000

        temp_diff = abs(temp - dew_point)
        fog_prob = 0
        if temp_diff < 3:
            fog_prob = min(90, (100 - (temp_diff * 30)) * (humidity / 100))

        frost_risk = "None"
        if temp < 4 and temp_diff < 2: frost_risk = "Low"
        if temp < 2: frost_risk = "Moderate"
        if temp < 0: frost_risk = "High"

        weather_data['intelligence'] = {
            "is_night": is_night,
            "fog_probability": f"{int(max(0, fog_prob))}%",
            "night_temp_drop": f"{int(weather_data['daily'][0]['temp'].get('day', 0) - weather_data['daily'][0]['temp'].get('night', -5))}°C",
            "uv_risk_level": "Low" if weather_data['current'].get('uvi', 0) < 3 else "Moderate" if weather_data['current'].get('uvi', 0) < 6 else "High",
            "moon_phase": moon_phase_name,
            "moon_phase_val": round(moon_phase_val, 2),
            "visibility_km": f"{round(visibility, 1)}km",
            "dew_point_c": f"{round(dew_point, 1)}°C",
            "frost_risk": frost_risk,
            "cloud_cover": f"{weather_data['current'].get('clouds', 0)}%"
        }

        return jsonify(weather_data)

    except requests.exceptions.RequestException as e:
        print(f"WEATHER ERROR (502): {e}")
        return jsonify({"error": f"Could not connect to weather service: {e}"}), 502
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred: {e}"}), 500

@app.route("/weather-intelligence", methods=["GET"])
def weather_intelligence():
    """Generates AI farming advice based on current weather for a city."""
    city = request.args.get("city")
    if not city:
        return jsonify({"error": "City is required"}), 400
    
    if not OPENWEATHER_API_KEY:
        return jsonify({"error": "Weather API key not configured"}), 500
        
    try:
        url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&units=metric&appid={OPENWEATHER_API_KEY}"
        weather_res = requests.get(url, timeout=10)
        weather_res.raise_for_status()
        data = weather_res.json()
        
        condition = data['weather'][0]['description']
        temp = data['main']['temp']
        humidity = data['main']['humidity']
        
        prompt = f"The current weather in {city} is {temp}°C with {humidity}% humidity and {condition}. Provide a short, practical 3-sentence farming advice for local farmers based on these conditions. Focus on irrigation, crop protection, or harvesting. Use simple English without markdown formatting."
        model = genai.GenerativeModel(TEXT_MODEL)
        response = model.generate_content(prompt)
        return jsonify({"advice": response.text})
    except Exception as e:
        import traceback
        err_msg = traceback.format_exc()
        print(f"WEATHER INTELLIGENCE ERROR: {e}\n{err_msg}", flush=True)
        if "429" in str(e) or "ResourceExhausted" in str(type(e).__name__) or "exceeded your current quota" in str(e):
             return jsonify({"advice": "AI quota exceeded. Please ensure crops have adequate water and monitor for pests. Wait a minute and refresh for tailored AI advice."})
        return jsonify({"error": f"Could not generate weather intelligence: {str(e)}"}), 500


@app.route("/weather-history", methods=["GET"])
def weather_history():
    """Fetches historical weather data for the last 7 days."""
    lat = request.args.get("lat")
    lon = request.args.get("lon")

    if not lat or not lon:
        return jsonify({"error": "Latitude and longitude are required"}), 400

    if not OPENWEATHER_API_KEY:
        return jsonify({"error": "Weather API key not configured"}), 500

    historical_data = []
    today = datetime.utcnow()

    try:
        for i in range(1, 8):
            past_date = today - timedelta(days=i)
            timestamp = int(past_date.timestamp())

            history_url = f"https://api.openweathermap.org/data/3.0/onecall/timemachine?lat={lat}&lon={lon}&dt={timestamp}&units=metric&appid={OPENWEATHER_API_KEY}"

            response = requests.get(history_url)
            response.raise_for_status()
            day_data = response.json()

            if day_data and day_data.get('data'):
                hourly_temps = [hour['temp'] for hour in day_data['data'][0]['hourly']]
                max_temp = max(hourly_temps) if hourly_temps else None
                min_temp = min(hourly_temps) if hourly_temps else None
                daily_summary = day_data['data'][0]

                historical_data.append({
                    "date": past_date.strftime('%Y-%m-%d'),
                    "temp_max": max_temp,
                    "temp_min": min_temp,
                    "condition": daily_summary['weather'][0]['main'],
                    "icon": daily_summary['weather'][0]['icon'],
                    "humidity": daily_summary['humidity'],
                    "wind_speed": daily_summary['wind_speed']
                })

        return jsonify({"history": historical_data[::-1]})

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Could not connect to weather history service: {e}"}), 502
    except Exception as e:
        print(f"WEATHER HISTORY ERROR: {e}")
        return jsonify({"error": f"An unexpected error occurred while fetching history: {e}"}), 500


@app.route("/prices", methods=["GET"])
def prices():
    """Fetches vegetable prices using a smart, two-step approach."""
    location_query = request.args.get('location', '').strip()
    vegetable_query = request.args.get('vegetable', '').strip()

    if not location_query or not vegetable_query:
        return jsonify({"error": "Location and vegetable parameters are required."}), 400

    try:
        print(f"INFO: Attempting to fetch real-time price for {vegetable_query} in {location_query}...")
        resource_id = "9ef84268-d588-465a-a308-a864a43d0070"
        gov_api_url = (f"https://api.data.gov.in/resource/{resource_id}?"
                       f"api-key={DATA_GOV_API_KEY}&format=json&"
                       f"filters[market]={location_query.title()}&"
                       f"filters[commodity]={vegetable_query.title()}")

        response = requests.get(gov_api_url, timeout=20)

        if response.status_code == 200:
            data = response.json()
            records = data.get('records', [])
            if records:
                print("SUCCESS: Found real-time price.")
                latest_record = records[-1]
                found_price = latest_record.get('modal_price', 'N/A')
                result = {
                    "prices": [{
                        "name": latest_record.get('commodity'),
                        "location": latest_record.get('market'),
                        "price": f"₹ {found_price} per Quintal"
                    }]
                }
                return jsonify(result)
    except requests.exceptions.RequestException as e:
        print(f"WARNING: Real-time API request failed: {e}. Proceeding to fallback.")
        pass

    # Step 2: Fallback to Google Search + Gemini AI
    try:
        print(f"INFO: Gov API failed. Attempting Google Search fallback for {vegetable_query} in {location_query}...")
        search_snippets = get_price_info_from_google(vegetable_query, location_query)

        prompt = f"""
        As an agricultural market expert, provide a single, average estimated market price for '{vegetable_query}' in the '{location_query}' region of India.

        Context from web search:
        {search_snippets if search_snippets else "No recent search data available."}

        Your entire response MUST be only a single, valid JSON object with no markdown or any other text.
        Use this exact structure: {{"estimated_price": "Approx. ₹Z per Kg"}}
        """

        model = genai.GenerativeModel(TEXT_MODEL)
        response = model.generate_content(prompt)

        price_data = extract_json(response.text)
        estimated_price = price_data.get("estimated_price", "Could not estimate.")

        print(f"SUCCESS: AI estimated price (via Search) retrieved.")
        result = {
            "prices": [{
                "name": vegetable_query.title(),
                "location": location_query.title(),
                "price": f"{estimated_price} (Market Search)"
            }]
        }
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"ERROR: Both Gov API and Google fallback failed. Error: {e}")
        return jsonify({"error": f"Sorry, could not find or estimate the price for {vegetable_query}."}), 500

@app.route("/vegetable-info", methods=["GET"])
def vegetable_info():
    """Fetches detailed information about a vegetable using the Gemini API."""
    vegetable_name = request.args.get('name', '').strip()
    if not vegetable_name:
        return jsonify({"error": "Vegetable name is required."}), 400

    try:
        prompt = f"""
        Provide a detailed guide for the vegetable '{vegetable_name}'.
        Your entire response MUST be a single, valid JSON object with no markdown or any other text.
        Use this exact structure:
        {{
          "name": "{vegetable_name.title()}",
          "image_search_term": "A simple search term to find a high-quality photo, e.g., 'Fresh {vegetable_name}'",
          "history": "A brief, interesting history of the vegetable's origin and its journey to India (2-3 sentences).",
          "cultivation": {{
            "soil": "Ideal soil type and pH range for this vegetable.",
            "water": "Watering requirements (e.g., frequency, amount).",
            "climate": "Suitable climate conditions (e.g., temperature range, sunlight)."
          }},
          "nutrition": [
            {{"nutrient": "Calories", "value": "Approx. value per 100g"}},
            {{"nutrient": "Vitamin C", "value": "Approx. value or % of Daily Value"}},
            {{"nutrient": "Potassium", "value": "Approx. value per 100g"}},
            {{"nutrient": "Fiber", "value": "Approx. value per 100g"}}
          ]
        }}
        """

        model = genai.GenerativeModel(
            TEXT_MODEL,
            generation_config={"response_mime_type": "application/json"}
        )
        response = model.generate_content(prompt)
        veg_data = extract_json(response.text)

        search_term = veg_data.get("image_search_term", vegetable_name)
        image_url = get_image_url_from_google(search_term)
        veg_data["image_url"] = image_url or f"https://source.unsplash.com/400x400/?{vegetable_name.replace(' ', '+')}"

        return jsonify(veg_data)

    except Exception as e:
        print(f"VEGETABLE INFO ERROR: {e}")
        return jsonify({"error": f"Could not retrieve details for {vegetable_name}."}), 500


def get_current_indian_season():
    """Determines the current Indian agricultural season."""
    current_month = datetime.now().month
    if 6 <= current_month <= 10:
        return "Kharif (Monsoon Crop)"
    elif 11 <= current_month or current_month <= 3:
        return "Rabi (Winter Crop)" 
    else:
        return "Zaid (Summer Crop)"

@app.route("/planner", methods=["POST"])
def planner():
    """Generates personalized crop recommendations based on land, season, and budget."""
    data = request.get_json() or {}
    land = data.get("land", "").strip()
    unit = data.get("unit", "Acres").strip()
    season = data.get("season", "").strip()
    location = data.get("location", "").strip()
    soil = data.get("soil", "").strip()
    budget = data.get("budget", "").strip()

    if not land:
        return jsonify({"error": "Land area is required"}), 400

    prompt = f"""
    As a master agricultural planner and agronomist in India, recommend the best crops for a farmer with the following details:
    - Land Area: {land} {unit}
    - Location/District: {location if location else 'India (General)'}
    - Season: {season if season else 'Current Season'}
    - Soil Type: {soil if soil else 'Not specified'}
    - Budget: {f'₹{budget}' if budget else 'Not specified'}

    Your entire response MUST be a single, valid JSON object with no markdown, no backticks, and no other text.
    Use this exact nested structure:
    {{
      "summary": "A brief, encouraging 2-sentence summary of the farming potential for this land and season.",
      "crops": [
        {{
          "name": "Crop Name",
          "season": "Best season for this crop",
          "estimated_yield": "e.g., 20-25 Tonnes",
          "estimated_cost": "e.g., 50,000",
          "expected_profit": "e.g., 1,50,000",
          "description": "A short paragraph explaining why this crop is a good choice for these conditions.",
          "tips": "2-3 practical farming tips for this specific crop."
        }}
      ]
    }}
    Provide exactly 3 to 4 crop recommendations.
    """
    
    if not GEMINI_API_KEY:
        print("ERROR: GEMINI_API_KEY is missing!")
        return jsonify({"error": "AI configuration error. Please contact support."}), 500

    try:
        print(f"DEBUG: AI Planner Inputs - Land: {land} {unit}, Location: {location}, Season: {season}")
        model = genai.GenerativeModel(TEXT_MODEL)
        response = model.generate_content(prompt)
        
        if not response.candidates:
            feedback = getattr(response, 'prompt_feedback', 'No feedback available')
            print(f"ERROR: No response candidates. Feedback: {feedback}")
            return jsonify({"error": "AI could not generate this plan. This might be due to safety filters. Please try with different phrasing."}), 500

        raw_text = response.text
        if not raw_text:
            print("ERROR: AI returned empty text.")
            return jsonify({"error": "AI returned an empty response. Please try again."}), 500

        print(f"DEBUG: AI Raw Text Received (Length: {len(raw_text)})")
        result = extract_json(raw_text)
        return jsonify(result)
    except Exception as e:
        import traceback
        error_msg = str(e)
        print(f"PLANNER ERROR: {error_msg}")
        traceback.print_exc()
        if "429" in error_msg or "quota" in error_msg.lower() or "ResourceExhausted" in error_msg:
            return jsonify({"plan": [{"crop": "Mock Wheat (Quota Exceeded)", "duration": "120 days", "roi": "High", "tips": "API rate limit reached. Please wait a minute and try again."}]})
        return jsonify({"error": "Could not generate a farming plan. Please try again later."}), 500


@app.route("/loan-eligibility", methods=["POST"])
def loan_eligibility():
    """AI-powered agricultural loan eligibility checker."""
    try:
        data = request.get_json()
        monthly_income = data.get("monthly_income", 0)
        land_acres = data.get("land_acres", 0)
        loan_amount = data.get("loan_amount", 0)
        purpose = data.get("purpose", "")
        state = data.get("state", "")

        prompt = f"""
        You are an Indian agricultural loan advisor. Analyze this farmer's loan application:
        - Monthly Income: ₹{monthly_income}
        - Land Owned: {land_acres} acres
        - Loan Amount Requested: ₹{loan_amount}
        - Purpose: {purpose}
        - State: {state}

        Respond ONLY with a valid JSON object (no markdown, no backticks):
        {{
          "eligible": true or false,
          "score": "a score from 0-100",
          "verdict": "one line verdict",
          "schemes": ["list of 2-3 relevant govt schemes like PM-KISAN, KCC, NABARD"],
          "tips": ["2-3 improvement tips if not eligible"],
          "monthly_emi": "estimated EMI at 4% interest"
        }}
        """

        if not GEMINI_API_KEY:
            return jsonify({"error": "Gemini API Key is missing in .env file."}), 500

        model = genai.GenerativeModel(TEXT_MODEL)
        response = model.generate_content(prompt)
        result = extract_json(response.text)
        return jsonify(result)
    except Exception as e:
        print(f"LOAN ELIGIBILITY ERROR: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/moderate-post", methods=["POST"])
def moderate_post():
    """AI moderation for community posts — checks if content is appropriate for the farming community."""
    try:
        data = request.get_json()
        content = data.get("content", "")

        if not content:
            return jsonify({"approved": True, "reason": ""}), 200

        prompt = f"""
        You are a content moderator for an Indian farmers' community forum.
        Check if this post is appropriate for the farming community.

        Post: "{content}"

        Respond ONLY with JSON (no markdown, no backticks):
        {{"approved": true or false, "reason": "brief reason if rejected"}}
        """

        if not GEMINI_API_KEY:
            # Default approve if AI unavailable
            return jsonify({"approved": True, "reason": ""}), 200

        model = genai.GenerativeModel(TEXT_MODEL)
        response = model.generate_content(prompt)
        result = extract_json(response.text)
        return jsonify(result)
    except Exception as e:
        print(f"MODERATE POST ERROR: {e}")
        # Default to approved on error — don't block community posts due to AI downtime
        return jsonify({"approved": True, "reason": ""}), 200


if __name__ == "__main__":
    print("Starting Flask server (backend/main.py)...")
    app.run(host='0.0.0.0', port=5000, debug=True)