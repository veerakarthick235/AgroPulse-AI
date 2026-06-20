"""
Seller Blueprint — Product CRUD, order management, dashboard stats.
"""
from flask import Blueprint, request, jsonify
from database import db
from auth_utils import require_jwt, require_approved_seller
from bson import ObjectId
from datetime import datetime

seller_bp = Blueprint('seller', __name__, url_prefix='/api/seller')

require_seller = require_jwt(required_role='seller')


# ─── Dashboard ──────────────────────────────────────────────────────────────

@seller_bp.route('/dashboard', methods=['GET'])
@require_seller
def get_seller_dashboard():
    """Returns key metrics for the seller's dashboard."""
    uid = request.uid
    try:
        products = list(db.products.find({'sellerId': uid}))
        total_products = len(products)
        live_products = sum(1 for p in products if p.get('isApproved', False) and p.get('isAvailable', True))

        orders = list(db.orders.find({'sellerId': uid}))
        pending_orders = sum(1 for o in orders if o.get('status') == 'pending')

        # calculate revenue for delivered or paid orders
        total_revenue = sum(
            o.get('totalAmount', 0) for o in orders
            if o.get('paymentStatus') == 'paid' or o.get('status') == 'delivered'
        )

        return jsonify({
            'totalProducts': total_products,
            'liveProducts': live_products,
            'pendingOrders': pending_orders,
            'totalRevenue': total_revenue,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Products ───────────────────────────────────────────────────────────────

@seller_bp.route('/products', methods=['GET'])
@require_seller
def get_my_products():
    """Returns all products added by this seller."""
    try:
        docs = db.products.find({'sellerId': request.uid})
        products = []
        for doc in docs:
            doc['id'] = str(doc.pop('_id'))
            products.append(doc)
        return jsonify({'products': products})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@seller_bp.route('/products', methods=['POST'])
@require_approved_seller
def add_product():
    """Adds a new product (isApproved=False until admin approves)."""
    data = request.get_json()

    required = ['name', 'price', 'stock', 'category']
    for field in required:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400

    if data.get('price', 0) <= 0:
        return jsonify({'error': 'Price must be greater than 0'}), 400
    if data.get('stock', 0) < 0:
        return jsonify({'error': 'Stock cannot be negative'}), 400

    product = {
        'sellerId': request.uid,
        'sellerName': request.user.get('displayName', ''),
        'name': data['name'],
        'description': data.get('description', ''),
        'category': data.get('category', 'vegetables'),
        'price': float(data['price']),
        'unit': data.get('unit', 'kg'),
        'stock': int(data['stock']),
        'imageUrl': data.get('imageUrl', ''),
        'images': data.get('images', []),
        'isApproved': False,
        'isAvailable': True,
        'rating': 0,
        'reviewCount': 0,
        'location': data.get('location', request.user.get('farmLocation', '')),
        'tags': data.get('tags', []),
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow(),
    }

    try:
        result = db.products.insert_one(product)
        product_id = str(result.inserted_id)

        # Notify admin
        db.notifications.insert_one({
            'userId': 'admin',
            'type': 'new_product',
            'title': 'New Product Awaiting Approval',
            'message': f"{request.user.get('displayName')} added '{data['name']}' — pending your review.",
            'isRead': False,
            'orderId': None,
            'productId': product_id,
            'createdAt': datetime.utcnow(),
        })

        return jsonify({'success': True, 'productId': product_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@seller_bp.route('/products/<product_id>', methods=['PUT'])
@require_seller
def update_product(product_id):
    """Update product details. Cannot change isApproved or sellerId."""
    data = request.get_json()

    # Prevent elevation of privileges
    restricted = ['isApproved', 'sellerId', 'sellerName']
    for field in restricted:
        data.pop(field, None)

    try:
        doc = db.products.find_one({'_id': ObjectId(product_id)})
        if not doc:
            return jsonify({'error': 'Product not found'}), 404
        if doc.get('sellerId') != request.uid:
            return jsonify({'error': 'Forbidden — not your product'}), 403

        data['updatedAt'] = datetime.utcnow()
        db.products.update_one({'_id': ObjectId(product_id)}, {'$set': data})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@seller_bp.route('/products/<product_id>', methods=['DELETE'])
@require_seller
def delete_product(product_id):
    """Delete a product owned by this seller."""
    try:
        doc = db.products.find_one({'_id': ObjectId(product_id)})
        if not doc:
            return jsonify({'error': 'Product not found'}), 404
        if doc.get('sellerId') != request.uid:
            return jsonify({'error': 'Forbidden — not your product'}), 403
            
        db.products.delete_one({'_id': ObjectId(product_id)})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Orders ─────────────────────────────────────────────────────────────────

@seller_bp.route('/orders', methods=['GET'])
@require_seller
def get_orders():
    """Returns all orders for this seller's products."""
    status_filter = request.args.get('status')
    try:
        query = {'sellerId': request.uid}
        if status_filter:
            query['status'] = status_filter
            
        docs = db.orders.find(query)
        orders = []
        for doc in docs:
            doc['id'] = str(doc.pop('_id'))
            orders.append(doc)
            
        orders.sort(key=lambda x: x.get('createdAt') or datetime.min, reverse=True)
        return jsonify({'orders': orders})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@seller_bp.route('/orders/<order_id>', methods=['PUT'])
@require_seller
def update_order(order_id):
    """
    Seller can move order: pending→confirmed, confirmed→packed.
    """
    data = request.get_json()
    new_status = data.get('status')

    valid_transitions = {
        'pending': 'confirmed',
        'confirmed': 'packed',
    }

    try:
        order = db.orders.find_one({'_id': ObjectId(order_id)})
        if not order:
            return jsonify({'error': 'Order not found'}), 404

        order_data = order

        if order_data.get('sellerId') != request.uid:
            return jsonify({'error': 'Forbidden — not your order'}), 403

        current_status = order_data.get('status')
        if valid_transitions.get(current_status) != new_status:
            return jsonify({'error': f'Cannot transition from {current_status} to {new_status}'}), 400

        db.orders.update_one({'_id': ObjectId(order_id)}, {'$set': {
            'status': new_status,
            'updatedAt': datetime.utcnow(),
        }})

        # Notify buyer
        db.notifications.insert_one({
            'userId': order_data.get('buyerId'),
            'type': 'order_update',
            'title': 'Order Status Updated',
            'message': f"Your order is now {new_status.replace('_', ' ').title()}.",
            'isRead': False,
            'orderId': order_id,
            'createdAt': datetime.utcnow(),
        })

        return jsonify({'success': True, 'newStatus': new_status})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
