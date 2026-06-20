"""
Buyer Blueprint — marketplace browsing, order placement and tracking.
"""
from flask import Blueprint, request, jsonify
from database import db
from auth_utils import require_jwt
from bson import ObjectId
from datetime import datetime

buyer_bp = Blueprint('buyer', __name__, url_prefix='/api/buyer')

require_buyer = require_jwt(required_role='buyer')
require_auth = require_jwt()


# ─── Products (public browse) ────────────────────────────────────────────────

@buyer_bp.route('/products', methods=['GET'])
def get_products():
    """Returns all approved products. Public route (no auth)."""
    category = request.args.get('category')
    search = request.args.get('search', '').lower()

    try:
        query = {'isApproved': True, 'isAvailable': True}
        if category:
            query['category'] = category

        docs = db.products.find(query)
        products = []
        for doc in docs:
            p = doc
            if search and search not in p.get('name', '').lower() and search not in p.get('description', '').lower():
                continue
            p['id'] = str(p.pop('_id'))
            products.append(p)

        return jsonify({'products': products})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@buyer_bp.route('/products/<product_id>', methods=['GET'])
def get_product_detail(product_id):
    """Returns details for a single product. Public route."""
    try:
        doc = db.products.find_one({'_id': ObjectId(product_id)})
        if not doc:
            return jsonify({'error': 'Product not found'}), 404

        p = doc
        p['id'] = str(p.pop('_id'))

        # Fetch reviews for this product
        reviews_docs = db.reviews.find({'productId': product_id})
        reviews = []
        for r in reviews_docs:
            rv = r
            rv['id'] = str(rv.pop('_id'))
            reviews.append(rv)

        p['reviews'] = reviews
        return jsonify(p)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Orders ─────────────────────────────────────────────────────────────────

@buyer_bp.route('/orders', methods=['POST'])
@require_buyer
def place_order():
    """Place a new order — writes to MongoDB and notifies the seller."""
    data = request.get_json()

    required = ['items', 'totalAmount', 'deliveryAddress']
    for field in required:
        if field not in data:
            return jsonify({'error': f'Missing: {field}'}), 400

    if not data['items'] or len(data['items']) == 0:
        return jsonify({'error': 'Order must have at least one item'}), 400

    # Deduce sellerId from first item's product
    try:
        first_product_id = data['items'][0].get('productId')
        product_doc = db.products.find_one({'_id': ObjectId(first_product_id)})
        if not product_doc:
            return jsonify({'error': 'Product not found'}), 404
        seller_id = product_doc.get('sellerId', '')
        seller_name = product_doc.get('sellerName', '')
    except Exception:
        seller_id = data.get('sellerId', '')
        seller_name = data.get('sellerName', '')

    order = {
        'buyerId': request.uid,
        'buyerName': request.user.get('displayName', ''),
        'buyerPhone': request.user.get('phone', ''),
        'sellerId': seller_id,
        'sellerName': seller_name,
        'deliveryAgentId': None,
        'items': data['items'],
        'totalAmount': float(data['totalAmount']),
        'status': 'pending',
        'paymentStatus': 'pending',
        'paymentMethod': data.get('paymentMethod', 'cod'),
        'razorpayOrderId': data.get('razorpayOrderId', ''),
        'razorpayPaymentId': '',
        'deliveryAddress': data['deliveryAddress'],
        'deliveryNotes': data.get('deliveryNotes', ''),
        'estimatedDelivery': None,
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow(),
    }

    try:
        # Reduce stock for each ordered item
        for item in data['items']:
            pid = item.get('productId')
            qty = int(item.get('quantity', 1))
            prod_snap = db.products.find_one({'_id': ObjectId(pid)})
            if prod_snap:
                current_stock = prod_snap.get('stock', 0)
                new_stock = max(0, current_stock - qty)
                db.products.update_one({'_id': ObjectId(pid)}, {'$set': {'stock': new_stock, 'updatedAt': datetime.utcnow()}})

        result = db.orders.insert_one(order)
        order_id = str(result.inserted_id)

        # Notify seller of new order
        if seller_id:
            db.notifications.insert_one({
                'userId': seller_id,
                'type': 'new_order',
                'title': '🛒 New Order Received!',
                'message': f"{request.user.get('displayName')} placed an order for ₹{data['totalAmount']}.",
                'isRead': False,
                'orderId': order_id,
                'createdAt': datetime.utcnow(),
            })

        return jsonify({'success': True, 'orderId': order_id}), 201
    except Exception as e:
        print(f'PLACE ORDER ERROR: {e}')
        return jsonify({'error': str(e)}), 500


@buyer_bp.route('/orders', methods=['GET'])
@require_buyer
def get_orders():
    """Returns all orders placed by this buyer."""
    try:
        docs = db.orders.find({'buyerId': request.uid})
        orders = []
        for doc in docs:
            doc['id'] = str(doc.pop('_id'))
            orders.append(doc)
        orders.sort(key=lambda x: x.get('createdAt') or datetime.min, reverse=True)
        return jsonify({'orders': orders})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@buyer_bp.route('/orders/<order_id>', methods=['GET'])
@require_buyer
def get_order_detail(order_id):
    """Returns a single order's detail for tracking."""
    try:
        doc = db.orders.find_one({'_id': ObjectId(order_id)})
        if not doc:
            return jsonify({'error': 'Order not found'}), 404
        
        if doc.get('buyerId') != request.uid:
            return jsonify({'error': 'Forbidden'}), 403
            
        doc['id'] = str(doc.pop('_id'))
        return jsonify(doc)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@buyer_bp.route('/orders/<order_id>/cancel', methods=['PUT'])
@require_buyer
def cancel_order(order_id):
    """Cancel a pending order."""
    try:
        doc = db.orders.find_one({'_id': ObjectId(order_id)})
        if not doc:
            return jsonify({'error': 'Order not found'}), 404
            
        if doc.get('buyerId') != request.uid:
            return jsonify({'error': 'Forbidden'}), 403
            
        if doc.get('status') != 'pending':
            return jsonify({'error': 'Only pending orders can be cancelled'}), 400

        db.orders.update_one({'_id': ObjectId(order_id)}, {'$set': {'status': 'cancelled', 'updatedAt': datetime.utcnow()}})

        # Restore stock
        for item in doc.get('items', []):
            pid = item.get('productId')
            qty = int(item.get('quantity', 1))
            prod_snap = db.products.find_one({'_id': ObjectId(pid)})
            if prod_snap:
                current_stock = prod_snap.get('stock', 0)
                db.products.update_one({'_id': ObjectId(pid)}, {'$set': {'stock': current_stock + qty, 'updatedAt': datetime.utcnow()}})

        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Reviews ─────────────────────────────────────────────────────────────────

@buyer_bp.route('/reviews', methods=['POST'])
@require_buyer
def add_review():
    """Add a review for a purchased product."""
    data = request.get_json()

    rating = int(data.get('rating', 0))
    if not 1 <= rating <= 5:
        return jsonify({'error': 'Rating must be between 1 and 5'}), 400

    review = {
        'productId': data.get('productId'),
        'buyerId': request.uid,
        'buyerName': request.user.get('displayName', ''),
        'rating': rating,
        'comment': data.get('comment', ''),
        'createdAt': datetime.utcnow(),
    }

    try:
        db.reviews.insert_one(review)

        # Update product average rating
        product_id = data.get('productId')
        reviews_docs = list(db.reviews.find({'productId': product_id}))
        ratings = [r.get('rating', 0) for r in reviews_docs]
        avg = round(sum(ratings) / len(ratings), 1) if ratings else 0

        db.products.update_one({'_id': ObjectId(product_id)}, {'$set': {
            'rating': avg,
            'reviewCount': len(ratings),
            'updatedAt': datetime.utcnow(),
        }})

        return jsonify({'success': True}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── Loans ──────────────────────────────────────────────────────────────────

@buyer_bp.route('/loans', methods=['POST'])
@require_auth
def apply_loan():
    """Submit a loan application."""
    data = request.get_json()
    
    application = {
        'userId': request.uid,
        'userName': data.get('fullName', ''),
        'phone': data.get('phone', ''),
        'aadhar': data.get('aadhar', ''),
        'address': data.get('address', ''),
        'landArea': data.get('landArea', ''),
        'farmType': data.get('farmType', ''),
        'loanType': data.get('loanType', ''),
        'loanAmount': data.get('loanAmount', ''),
        'purpose': data.get('purpose', ''),
        'repaymentPeriod': data.get('repaymentPeriod', ''),
        'bankName': data.get('bankName', ''),
        'accountNumber': data.get('accountNumber', ''),
        'ifscCode': data.get('ifscCode', ''),
        'status': 'submitted',
        'estimatedEmi': data.get('estimatedEmi', 0),
        'createdAt': datetime.utcnow(),
    }
    
    try:
        result = db.loanApplications.insert_one(application)
        return jsonify({'success': True, 'applicationId': str(result.inserted_id)}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── Wishlists ──────────────────────────────────────────────────────────────

@buyer_bp.route('/wishlists', methods=['GET'])
@require_buyer
def get_wishlists():
    """Returns all wishlist items for this buyer."""
    try:
        docs = db.wishlists.find({'buyerId': request.uid})
        items = {}
        for doc in docs:
            pid = doc.get('productId')
            doc['id'] = str(doc.pop('_id', ''))
            items[pid] = doc
        return jsonify(items)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@buyer_bp.route('/wishlists', methods=['POST'])
@require_buyer
def add_to_wishlist():
    """Adds a product to wishlist."""
    data = request.get_json()
    product_id = data.get('productId')
    
    if not product_id:
        return jsonify({'error': 'productId required'}), 400
        
    doc = {
        'buyerId': request.uid,
        'productId': product_id,
        'productName': data.get('productName', ''),
        'price': data.get('price', 0),
        'unit': data.get('unit', 'kg'),
        'imageUrl': data.get('imageUrl', ''),
        'sellerId': data.get('sellerId', ''),
        'sellerName': data.get('sellerName', ''),
        'stock': data.get('stock', 0),
        'addedAt': datetime.utcnow()
    }
    
    try:
        db.wishlists.update_one(
            {'buyerId': request.uid, 'productId': product_id},
            {'$set': doc},
            upsert=True
        )
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@buyer_bp.route('/wishlists/<product_id>', methods=['DELETE'])
@require_buyer
def remove_from_wishlist(product_id):
    """Removes a product from wishlist."""
    try:
        db.wishlists.delete_one({'buyerId': request.uid, 'productId': product_id})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

