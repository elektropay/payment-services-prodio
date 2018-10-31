import React, { Component } from 'react'
import { connect } from 'react-redux'
import { ShowPayments } from '../actions'
import PaymentItem from './PaymentItem'

class Payment extends Component {
 
    componentWillMount(){
        this.props.ShowPayments()
    }
    

    render(){
        const paymentItems = this.props.payments.map((payment, i) => {
            return(
                <PaymentItem key={payment.id} item={payment} /> 
            )
        })
        return (
            <div>
                <h1>Payments</h1>
                <ul className="collection">
                    {paymentItems}
                </ul>
            </div>
        )
    }
}


function mapStateToProps(state) {
    return {
      payments: state.payments.payments 
    }
}
  
export default connect(mapStateToProps, { ShowPayments })(Payment)