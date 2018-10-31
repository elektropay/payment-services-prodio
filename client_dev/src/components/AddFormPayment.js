import React, { Component } from 'react'
import { connect } from 'react-redux'
import { AddPayment } from '../actions'

class AddFormPayment extends Component {

    newPayment(newPayment){
        this.props.AddPayment(newPayment)
    }

    onSubmit(e){
        const newPayment = {
            method: this.refs.method.value,
            amount: this.refs.amount.value,
            date: this.refs.date.value,
        }

        this.newPayment(newPayment)
        e.preventDefault()
    }

    render(){
        return (
            <div>
                <h1>
                   Add Payment
                </h1>
                <form onSubmit={this.onSubmit.bind(this)}>
                    <div className="input-field">
                        <input type="text" name="method" ref="method" placeholder="Método de pago" />
                    </div>
                    <div className="input-field">
                        <input type="text" name="amount" ref="amount" placeholder="Monto" />
                    </div>
                    <div className="input-field">
                        <input type="date" name="date" ref="date" />
                    </div>
                    <input type="submit" value="Save" className="btn-btnsave" />
                </form>
            </div>
        )
    }
}

function mapStateToProps(state) {
    return {
      payments: state.payments.payments 
    }
}
  
export default connect(mapStateToProps, { AddPayment })(AddFormPayment)