import axios from 'axios'

//type actions
export const SHOW_PAYMENTS = 'SHOW_PAYMENTS';
export const ADD_PAYMENT = 'ADD_PAYMENT';
export const DELETE_PAYMENT = 'DELETE_PAYMENT';
export const GET_PAYMENT_DETAIL = 'GET_PAYMENT_DETAIL';
export const UPDATE_PAYMENT = 'UPDATE_PAYMENT';

//actions
export function ShowPayments() {   
    return (dispatch) => {
        axios.get('http://localhost:3001/api/payments')
            .then((response) => {
                dispatch( { type: SHOW_PAYMENTS, payload: response.data } ) 
            }).catch(err => console.log(err))
    }   
}

export function AddPayment(newPayment) {   
    return (dispatch) => {
            axios.request({
                method: 'post',
                url: 'http://localhost:3001/api/payments',
                data: newPayment
            }).then(response => {
                dispatch( { type: ADD_PAYMENT, payload: response.data } ) 
            }).catch(err => console.log(err))
    }   
}

export function getPaymentDetail(id) {   
    return (dispatch) => {
        axios.get(`http://localhost:3001/api/payments/${id}`)
            .then((response) => {
                dispatch( { type: GET_PAYMENT_DETAIL, payload: response.data } ) 
            }).catch(err => console.log(err))
    }   
}


export function EditPayment(Payment) {   
    return (dispatch) => {
        axios.request({
            method: 'put',
            url: `http://localhost:3001/api/payments/${Payment.id}`,
            data: Payment
        }).then(response => {
            dispatch( { type: UPDATE_PAYMENT, payload: response.data } ) 
        }).catch(err => console.log(err))
    }   
}


export function DeletePayment(id) {   
    return (dispatch) => {
            axios.delete(`http://localhost:3001/api/payments/${id}`)
            .then(response => {
                dispatch( { type: DELETE_PAYMENT, payload: id } ) 
            }).catch(err => console.log(err)) 
    }   
}