"""
Admin Blueprint — Full platform management: users, products, orders, analytics.
Requires admin role (manually set in Firestore by the developer).
"""
from flask import Blueprint, request, jsonify
from database import db
from auth_utils import require_jwt
from bson import ObjectId
from datetime import datetime

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

require_admin = require_jwt(required_role='admin')


# ─── Dashboard Stats ─────────────────────────────────────────────────────────

@admin_bp.route('/stats', methods=['GET'])
@require_admin
def get_stats():
    """KPI dashboard: users, orders, revenue, pending approvals."""
    try:
        users = list(db.users.find())
        buyers = sum(1 for u in users if u.get('role') == 'buyer')
        
        delivery_agents = sum(1 for u in users if u.get('role') == 'delivery')
        
        orders = list(db.orders.find())

        total_revenue = sum(o.get('totalAmount', 0) for o in orders if o.get('paymentStatus') == 'paid')
        pending_orders = sum(1 for o in orders if o.get('status') == 'pending')

        products = list(db.products.find())
        

        return jsonify({
            'totalUsers': len(users),
            'buyers': buyers,
            
            'deliveryAgents': delivery_agents,
            
            'totalOrders': len(orders),
            'pendingOrders': pending_orders,
            'totalRevenue': total_revenue,
            
            'totalProducts': len(products),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── User Management ─────────────────────────────────────────────────────────

@admin_bp.route('/users', methods=['GET'])
@require_admin
def get_users():
    """Returns all users, optionally filtered by role."""
    role_filter = request.args.get('role')
    try:
        query = {}
        if role_filter:
            query['role'] = role_filter
        docs = db.users.find(query)
        users = []
        for doc in docs:
            doc['id'] = str(doc.pop('_id'))
            users.append(doc)
        return jsonify({'users': users})
    except Exception as e:
        return jsonify({'error': str(e)}), 500




@admin_bp.route('/users/<user_id>/toggle-active', methods=['PUT'])
@require_admin
def toggle_user_active(user_id):
    """Block or unblock any user."""
    data = request.get_json()
    is_active = data.get('isActive', True)
    try:
        db.users.update_one({'_id': ObjectId(user_id)}, {'$set': {
            'isActive': is_active,
            'updatedAt': datetime.utcnow(),
        }})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<user_id>', methods=['PUT'])
@require_admin
def update_user(user_id):
    """Admin can edit any user field."""
    data = request.get_json()
    data['updatedAt'] = datetime.utcnow()
    try:
        db.users.update_one({'_id': ObjectId(user_id)}, {'$set': data})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<user_id>/role', methods=['PUT'])
@require_admin
def change_user_role(user_id):
    """Change the role of any user."""
    data = request.get_json()
    new_role = data.get('role')
    if not new_role:
        return jsonify({'error': 'Role is required'}), 400
    try:
        db.users.update_one({'_id': ObjectId(user_id)}, {'$set': {
            'role': new_role,
            'updatedAt': datetime.utcnow(),
        }})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Product Moderation ───────────────────────────────────────────────────────

@admin_bp.route('/products/pending', methods=['GET'])
@require_admin
def get_pending_products():
    """All products awaiting admin approval."""
    try:
        docs = db.products.find({'isApproved': False})
        products = []
        for doc in docs:
            doc['id'] = str(doc.pop('_id'))
            products.append(doc)
        return jsonify({'products': products})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/products', methods=['GET'])
@require_admin
def get_all_products():
    """All products on the platform."""
    approval_filter = request.args.get('approved')
    try:
        query = {}
        if approval_filter == 'true':
            query['isApproved'] = True
        elif approval_filter == 'false':
            query['isApproved'] = False
        docs = db.products.find(query)
        products = []
        for doc in docs:
            doc['id'] = str(doc.pop('_id'))
            products.append(doc)
        return jsonify({'products': products})
    except Exception as e:
        return jsonify({'error': str(e)}), 500



@admin_bp.route('/products', methods=['POST'])
@require_admin
def add_product():
    data = request.get_json()
    product = {
        'sellerId': 'admin',
        'sellerName': 'AgroPulse Admin',
        'name': data.get('name'),
        'description': data.get('description', ''),
        'category': data.get('category', 'vegetables'),
        'price': float(data.get('price', 0)),
        'unit': data.get('unit', 'kg'),
        'stock': int(data.get('stock', 0)),
        'imageUrl': data.get('imageUrl', ''),
        'images': data.get('images', []),
        'isApproved': True,
        'isAvailable': True,
        'rating': 0,
        'reviewCount': 0,
        'location': data.get('location', ''),
        'tags': data.get('tags', []),
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow(),
    }
    try:
        result = db.products.insert_one(product)
        return jsonify({'success': True, 'productId': str(result.inserted_id)}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500



@admin_bp.route('/products/<product_id>', methods=['PUT'])
@require_admin
def edit_product(product_id):
    """Admin can edit any product field."""
    data = request.get_json()
    data['updatedAt'] = datetime.utcnow()
    try:
        db.products.update_one({'_id': ObjectId(product_id)}, {'$set': data})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/products/<product_id>', methods=['DELETE'])
@require_admin
def delete_product(product_id):
    """Delete any product."""
    try:
        db.products.delete_one({'_id': ObjectId(product_id)})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Order Management ─────────────────────────────────────────────────────────

@admin_bp.route('/orders', methods=['GET'])
@require_admin
def get_all_orders():
    """All orders across the platform, with optional status filter."""
    status_filter = request.args.get('status')
    try:
        query = {}
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


@admin_bp.route('/orders/<order_id>/assign', methods=['PUT'])
@require_admin
def assign_delivery_agent(order_id):
    """Assign a delivery agent to an order."""
    data = request.get_json()
    agent_id = data.get('agentId')
    if not agent_id:
        return jsonify({'error': 'agentId is required'}), 400

    try:
        # Get agent name
        agent_doc = db.users.find_one({'_id': ObjectId(agent_id)})
        agent_name = agent_doc.get('displayName', '') if agent_doc else ''

        db.orders.update_one({'_id': ObjectId(order_id)}, {'$set': {
            'deliveryAgentId': agent_id,
            'deliveryAgentName': agent_name,
            'updatedAt': datetime.utcnow(),
        }})

        # Mark agent as unavailable
        db.deliveryAgents.update_one({'userId': agent_id}, {'$set': {'isAvailable': False, 'currentOrderId': order_id}})

        # Notify agent
        db.notifications.insert_one({
            'userId': agent_id,
            'type': 'order_update',
            'title': '📦 New Delivery Assigned',
            'message': 'A new order has been assigned to you for delivery.',
            'isRead': False,
            'orderId': order_id,
            'createdAt': datetime.utcnow(),
        })

        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/orders/<order_id>/status', methods=['PUT'])
@require_admin
def override_order_status(order_id):
    """Admin can override any order status."""
    data = request.get_json()
    new_status = data.get('status')
    valid_statuses = ['pending', 'confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered', 'cancelled']
    if new_status not in valid_statuses:
        return jsonify({'error': f'Invalid status: {new_status}'}), 400
    try:
        db.orders.update_one({'_id': ObjectId(order_id)}, {'$set': {
            'status': new_status,
            'updatedAt': datetime.utcnow(),
        }})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Delivery Agents ──────────────────────────────────────────────────────────

@admin_bp.route('/delivery-agents', methods=['GET'])
@require_admin
def get_delivery_agents():
    """List all delivery agents."""
    try:
        docs = db.deliveryAgents.find()
        agents = []
        for doc in docs:
            doc['id'] = str(doc.pop('_id'))
            agents.append(doc)
        return jsonify({'agents': agents})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/delivery-agents', methods=['POST'])
@require_admin
def create_delivery_agent():
    """Register a new delivery agent."""
    data = request.get_json()
    agent = {
        'userId': data.get('userId', ''),
        'name': data.get('name', ''),
        'phone': data.get('phone', ''),
        'isAvailable': True,
        'currentOrderId': None,
        'totalDeliveries': 0,
        'rating': 0,
        'createdAt': datetime.utcnow(),
    }
    try:
        result = db.deliveryAgents.insert_one(agent)
        return jsonify({'success': True, 'agentId': str(result.inserted_id)}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/delivery-agents/<agent_id>', methods=['PUT'])
@require_admin
def update_delivery_agent(agent_id):
    """Admin can edit delivery agent fields (e.g. availability)."""
    data = request.get_json()
    try:
        db.deliveryAgents.update_one({'_id': ObjectId(agent_id)}, {'$set': data})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Analytics ────────────────────────────────────────────────────────────────

@admin_bp.route('/analytics', methods=['GET'])
@require_admin
def get_analytics():
    """Revenue and order analytics for charts."""
    try:
        orders_docs = db.orders.find()
        orders_data = []
        for doc in orders_docs:
            doc['id'] = str(doc.pop('_id'))
            orders_data.append(doc)

        # Category-wise sales
        products_docs = db.products.find()
        products = {str(p['_id']): p for p in products_docs}
        
        category_revenue = {}
        for order in orders_data:
            if order.get('paymentStatus') == 'paid':
                for item in order.get('items', []):
                    pid = item.get('productId', '')
                    category = products.get(pid, {}).get('category', 'other')
                    category_revenue[category] = category_revenue.get(category, 0) + (
                        item.get('price', 0) * item.get('quantity', 1)
                    )

        # Top products by revenue
        product_revenue = {}
        for order in orders_data:
            if order.get('paymentStatus') == 'paid':
                for item in order.get('items', []):
                    name = item.get('productName', 'Unknown')
                    product_revenue[name] = product_revenue.get(name, 0) + (
                        item.get('price', 0) * item.get('quantity', 1)
                    )

        top_products = sorted(product_revenue.items(), key=lambda x: x[1], reverse=True)[:8]

        # Monthly revenue (last 6 months)
        from dateutil.relativedelta import relativedelta
        import calendar
        monthly_data = []
        user_growth = []
        now = datetime.utcnow()
        for i in range(5, -1, -1):
            target_date = now - relativedelta(months=i)
            target_month = target_date.month
            target_year = target_date.year
            month_label = calendar.month_abbr[target_month]
            
            # Revenue
            month_rev = sum(
                o.get('totalAmount', 0) for o in orders_data
                if o.get('paymentStatus') == 'paid' and o.get('createdAt') and o['createdAt'].month == target_month and o['createdAt'].year == target_year
            )
            monthly_data.append({'month': month_label, 'revenue': round(month_rev)})
            
            # Users
            users_docs = list(db.users.find())
            month_users = sum(
                1 for u in users_docs
                if u.get('createdAt') and u['createdAt'].month == target_month and u['createdAt'].year == target_year
            )
            user_growth.append({'month': month_label, 'users': month_users})
            
        paid_orders = [o for o in orders_data if o.get('paymentStatus') == 'paid']

        return jsonify({
            'categoryRevenue': category_revenue,
            'topProducts': [{'name': k, 'revenue': v} for k, v in top_products],
            'totalOrders': len(orders_data),
            'paidOrdersCount': len(paid_orders),
            'totalUsers': len(users_docs),
            'totalRevenue': sum(o.get('totalAmount', 0) for o in paid_orders),
            'monthlyData': monthly_data,
            'userGrowth': user_growth
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
