import React, { Component } from 'react'
import { Link } from 'react-router-dom'
import { connect } from 'react-redux'
import { DeletePayment } from '../actions'

class PaymentItem extends Component {
    constructor(props){
        super(props)
        this.state = {
            item: props.item
        }
        
    }

    deletePayment(id){
        this.props.DeletePayment(id)
    }

    render(){
        return (
            <li>         
                <Link to = {`/payments/${this.state.item.id}`}> 
                    {this.state.item.method} | {this.state.item.amount} Bs | {this.state.item.date}
                </Link>
                <a onClick={() => this.deletePayment(this.state.item.id)} className="rm">Delete</a>
            </li>     
        )
    }
}


function mapStateToProps(state) {
    return {
      payments: state.payments.payments 
    }
}
  
export default connect(mapStateToProps, { DeletePayment })(PaymentItem)