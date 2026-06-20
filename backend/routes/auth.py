import os
import datetime
import jwt
import bcrypt
import requests
from flask import Blueprint, request, jsonify
from database import db
from bson import ObjectId

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-jwt-key-replace-in-production")

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    displayName = data.get('displayName', '')
    role = data.get('role', 'buyer')
    
    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
        
    if db.users.find_one({'email': email}):
        return jsonify({'error': 'User with this email already exists'}), 400

    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    allowed_roles = ['buyer', 'seller', 'delivery']
    if role not in allowed_roles:
        role = 'buyer'

    user_profile = {
        'email': email,
        'password': hashed_pw.decode('utf-8'),
        'displayName': displayName,
        'role': role,
        'phone': data.get('phone', ''),
        'address': data.get('address', {}),
        'profileImageUrl': data.get('profileImageUrl', ''),
        'isApproved': False if role == 'seller' else True,
        'isActive': True,
        'createdAt': datetime.datetime.utcnow(),
        'updatedAt': datetime.datetime.utcnow(),
    }

    if role == 'seller':
        user_profile['farmName'] = data.get('farmName', '')
        user_profile['farmLocation'] = data.get('farmLocation', '')
        user_profile['produceType'] = data.get('produceType', '')

    try:
        result = db.users.insert_one(user_profile)
        uid = str(result.inserted_id)
        
        # Generate token
        token = jwt.encode({
            'uid': uid,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
        }, JWT_SECRET_KEY, algorithm="HS256")
        
        return jsonify({
            'success': True, 
            'uid': uid, 
            'role': role, 
            'token': token,
            'user': {
                'uid': uid,
                'email': email,
                'displayName': displayName,
                'role': role
            }
        }), 201
    except Exception as e:
        print(f'REGISTER ERROR: {e}')
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
        
    user = db.users.find_one({'email': email})
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
        
    if not bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
        return jsonify({'error': 'Invalid credentials'}), 401
        
    uid = str(user['_id'])
    token = jwt.encode({
        'uid': uid,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }, JWT_SECRET_KEY, algorithm="HS256")
    
    return jsonify({
        'success': True,
        'token': token,
        'user': {
            'id': uid,
            'uid': uid,
            'role': user.get('role', 'buyer'),
            'isApproved': user.get('isApproved', False),
            'displayName': user.get('displayName', ''),
            'email': user.get('email', ''),
            'profileImageUrl': user.get('profileImageUrl', ''),
        }
    })

@auth_bp.route('/google-login', methods=['POST'])
def google_login():
    data = request.get_json()
    google_token = data.get('token')
    
    if not google_token:
        return jsonify({'error': 'No Google token provided'}), 400
        
    try:
        # Fetch user info from Google using the access token
        google_response = requests.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {google_token}'}
        )
        
        if google_response.status_code != 200:
            return jsonify({'error': 'Failed to authenticate with Google'}), 401
            
        user_info = google_response.json()
        email = user_info.get('email')
        
        if not email:
            return jsonify({'error': 'Google token did not contain an email'}), 400
            
        # Check if user exists
        user = db.users.find_one({'email': email})
        
        if not user:
            # Create a new user if they don't exist
            user_profile = {
                'email': email,
                'password': '', # No password for Google users
                'displayName': user_info.get('name', ''),
                'role': 'buyer',
                'phone': '',
                'address': {},
                'profileImageUrl': user_info.get('picture', ''),
                'createdAt': datetime.datetime.utcnow(),
                'isApproved': True # Buyers are auto-approved
            }
            result = db.users.insert_one(user_profile)
            uid = str(result.inserted_id)
            user = db.users.find_one({'_id': result.inserted_id})
        else:
            uid = str(user['_id'])
            
        # Generate our JWT token
        token = jwt.encode({
            'uid': uid,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
        }, JWT_SECRET_KEY, algorithm="HS256")
        
        return jsonify({
            'success': True,
            'token': token,
            'user': {
                'id': uid,
                'uid': uid,
                'role': user.get('role', 'buyer'),
                'isApproved': user.get('isApproved', False),
                'displayName': user.get('displayName', ''),
                'email': user.get('email', ''),
                'profileImageUrl': user.get('profileImageUrl', ''),
            }
        }), 201
        
    except Exception as e:
        print(f'GOOGLE LOGIN ERROR: {e}')
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/verify-token', methods=['POST'])
def verify_token():
    # Backward compatibility for frontend during migration
    # Frontend can send JWT as idToken to get user details
    data = request.get_json()
    token = data.get('idToken', '')
    if not token:
        return jsonify({'error': 'No token provided'}), 400
        
    try:
        decoded = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        uid = decoded['uid']
        user = db.users.find_one({"_id": ObjectId(uid)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        return jsonify({
            'uid': uid,
            'role': user.get('role', 'buyer'),
            'isApproved': user.get('isApproved', False),
            'displayName': user.get('displayName', ''),
            'email': user.get('email', ''),
            'profileImageUrl': user.get('profileImageUrl', ''),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 401

from auth_utils import require_jwt

@auth_bp.route('/profile', methods=['GET'])
@require_jwt()
def get_profile():
    uid = request.uid
    try:
        user = db.users.find_one({"_id": ObjectId(uid)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        profile = {
            'id': str(user['_id']),
            'email': user.get('email', ''),
            'displayName': user.get('displayName', ''),
            'role': user.get('role', 'buyer'),
            'isApproved': user.get('isApproved', False),
            'phone': user.get('phone', ''),
            'address': user.get('address', {}),
            'profileImageUrl': user.get('profileImageUrl', ''),
            'farmName': user.get('farmName', ''),
            'farmLocation': user.get('farmLocation', ''),
            'produceType': user.get('produceType', '')
        }
        return jsonify({'profile': profile})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/profile', methods=['PUT'])
@require_jwt()
def update_profile():
    data = request.get_json()
    uid = request.uid
    
    updates = {}
    if 'displayName' in data:
        updates['displayName'] = data['displayName']
    if 'phone' in data:
        updates['phone'] = data['phone']
    if 'address' in data:
        updates['address'] = data['address']
    if 'profileImageUrl' in data:
        updates['profileImageUrl'] = data['profileImageUrl']
    
    # Support for BecomeSeller and seller/delivery profiles
    if 'role' in data:
        updates['role'] = data['role']
    if 'isApproved' in data:
        updates['isApproved'] = data['isApproved']
    if 'isActive' in data:
        updates['isActive'] = data['isActive']
    if 'farmLocation' in data:
        updates['farmLocation'] = data['farmLocation']
    if 'produceType' in data:
        updates['produceType'] = data['produceType']
    if 'sellerProfile' in data:
        updates['sellerProfile'] = data['sellerProfile']
    if 'deliveryProfile' in data:
        updates['deliveryProfile'] = data['deliveryProfile']
        
    updates['updatedAt'] = datetime.datetime.utcnow()
    
    try:
        db.users.update_one({'_id': ObjectId(uid)}, {'$set': updates})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

