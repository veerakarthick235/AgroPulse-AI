"""
Delivery Agent Blueprint — View and update assigned orders, toggle availability.
"""
from flask import Blueprint, request, jsonify
from database import db
from auth_utils import require_jwt
from bson import ObjectId
from datetime import datetime

delivery_bp = Blueprint('delivery', __name__, url_prefix='/api/delivery')

require_delivery = require_jwt(required_role='delivery')


@delivery_bp.route('/orders', methods=['GET'])
@require_delivery
def get_assigned_orders():
    """Returns all orders assigned to this delivery agent."""
    try:
        docs = db.orders.find({'deliveryAgentId': request.uid})
        orders = []
        for doc in docs:
            doc['id'] = str(doc.pop('_id'))
            orders.append(doc)
        
        # Sort by creation date descending
        orders.sort(key=lambda x: x.get('createdAt') or datetime.min, reverse=True)
        return jsonify({'orders': orders})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@delivery_bp.route('/orders/<order_id>/status', methods=['PUT'])
@require_delivery
def update_delivery_status(order_id):
    """
    Delivery agent updates order status:
    packed → dispatched → out_for_delivery → delivered
    """
    data = request.get_json()
    new_status = data.get('status')

    valid_transitions = {
        'packed': 'dispatched',
        'dispatched': 'out_for_delivery',
        'out_for_delivery': 'delivered',
    }

    try:
        doc = db.orders.find_one({'_id': ObjectId(order_id)})
        if not doc:
            return jsonify({'error': 'Order not found'}), 404

        order_data = doc

        if order_data.get('deliveryAgentId') != request.uid:
            return jsonify({'error': 'This order is not assigned to you'}), 403

        current_status = order_data.get('status')
        if valid_transitions.get(current_status) != new_status:
            return jsonify({'error': f'Cannot transition from {current_status} to {new_status}'}), 400

        update_data = {
            'status': new_status,
            'updatedAt': datetime.utcnow(),
        }

        # On delivery — upload proof photo URL if provided
        if new_status == 'delivered' and data.get('proofImageUrl'):
            update_data['deliveryProofUrl'] = data.get('proofImageUrl')

        db.orders.update_one({'_id': ObjectId(order_id)}, {'$set': update_data})

        # Notify buyer
        status_messages = {
            'dispatched': '🚚 Your order has been dispatched!',
            'out_for_delivery': '📍 Your order is out for delivery!',
            'delivered': '🎉 Your order has been delivered!',
        }
        db.notifications.insert_one({
            'userId': order_data.get('buyerId'),
            'type': 'order_update',
            'title': 'Order Update',
            'message': status_messages.get(new_status, f'Order status: {new_status}'),
            'isRead': False,
            'orderId': order_id,
            'createdAt': datetime.utcnow(),
        })

        # If delivered, mark agent as available again
        if new_status == 'delivered':
            agent_record = db.deliveryAgents.find_one({'userId': request.uid})
            if agent_record:
                current_deliveries = agent_record.get('totalDeliveries', 0)
                db.deliveryAgents.update_one(
                    {'_id': agent_record['_id']},
                    {'$set': {
                        'isAvailable': True,
                        'currentOrderId': None,
                        'totalDeliveries': current_deliveries + 1,
                    }}
                )

        return jsonify({'success': True, 'newStatus': new_status})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@delivery_bp.route('/availability', methods=['PUT'])
@require_delivery
def toggle_availability():
    """Agent toggles their availability status."""
    data = request.get_json()
    is_available = data.get('isAvailable', True)

    try:
        agent_record = db.deliveryAgents.find_one({'userId': request.uid})
        
        if not agent_record:
            return jsonify({'error': 'Delivery agent record not found. Contact admin.'}), 404

        db.deliveryAgents.update_one(
            {'_id': agent_record['_id']},
            {'$set': {'isAvailable': is_available}}
        )

        return jsonify({'success': True, 'isAvailable': is_available})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@delivery_bp.route('/profile', methods=['GET'])
@require_delivery
def get_delivery_profile():
    """Returns delivery agent's profile and stats."""
    try:
        agent_record = db.deliveryAgents.find_one({'userId': request.uid})
        if not agent_record:
            return jsonify({'error': 'Delivery agent record not found.'}), 404
            
        agent_record['id'] = str(agent_record.pop('_id'))
        
        # Merge with base user profile
        user_doc = request.user
        
        profile = {
            **user_doc,
            'agentData': agent_record
        }
        
        return jsonify({'profile': profile})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
