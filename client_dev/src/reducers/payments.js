
import { 
SHOW_PAYMENTS, 
ADD_PAYMENT, 
UPDATE_PAYMENT,
GET_PAYMENT_DETAIL,
DELETE_PAYMENT 
} from '../actions'

const initialState = {
    payments: []
}

export function reducer(state = initialState, action) {
    switch (action.type) {
        case SHOW_PAYMENTS:
            return Object.assign({}, state, {payments: action.payload})
        case ADD_PAYMENT:
            return {
                ...state,
                payments: [...state.payments, action.payload]}
        case GET_PAYMENT_DETAIL:
            return Object.assign({}, state, {payments: action.payload})
        case UPDATE_PAYMENT:
            return {
                ...state,
                payments: [...state.payments, action.payload]}
        case DELETE_PAYMENT:
            return Object.assign({}, state, {
                payments: [...state.payments.filter(payments => payments.id !== action.payload)],
              });
        default:
            return state
    }
    
}
