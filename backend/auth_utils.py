import os
import jwt
from functools import wraps
from flask import request, jsonify
from database import db
from bson import ObjectId

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-jwt-key-replace-in-production")

def require_jwt(required_role=None):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            token = request.headers.get('Authorization', '').replace('Bearer ', '')
            if not token:
                return jsonify({'error': 'Authorization token required'}), 401
            
            try:
                decoded = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
                uid = decoded['uid']
                
                # Fetch user from MongoDB to ensure they exist and optionally check role
                user = db.users.find_one({"_id": ObjectId(uid)})
                if not user:
                    return jsonify({'error': 'User not found'}), 404
                
                if required_role and user.get('role') != required_role:
                    return jsonify({'error': f'{required_role} access required'}), 403
                
                request.uid = uid
                request.user = user
                # convert _id to string for convenience in routes
                request.user['id'] = str(request.user.pop('_id'))
                return f(*args, **kwargs)
                
            except jwt.ExpiredSignatureError:
                return jsonify({'error': 'Token expired'}), 401
            except jwt.InvalidTokenError:
                return jsonify({'error': 'Invalid token'}), 401
            except Exception as e:
                return jsonify({'error': str(e)}), 401
        return decorated
    return decorator

def require_approved_seller(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        return require_jwt(required_role='seller')(
            lambda *a, **kw: check_approved_seller(f, *a, **kw)
        )(*args, **kwargs)
    return decorated

def check_approved_seller(f, *args, **kwargs):
    user = request.user
    if not user.get('isApproved'):
        return jsonify({'error': 'Account not approved yet. Please wait for admin approval.'}), 403
    return f(*args, **kwargs)
