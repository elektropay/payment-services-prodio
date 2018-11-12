import React, { Component } from 'react'
import { connect } from 'react-redux'
import { EditPayment, getPaymentDetail } from '../actions'

class EditFormPayment extends Component {

    componentWillMount(){
        const id = this.props.match.params.id;
        this.props.getPaymentDetail(id)
    }


    editPayment(Payment){
        this.props.EditPayment(Payment)
    }

    onSubmit(e){
        const Payment = {
            method: this.refs.method.value,
            date: this.refs.date.value,
        }

        this.editPayment(Payment)
        e.preventDefault()
    }

    render(){
        return (
            <div>
                <h1>
                   Edit Payment
                </h1>
                <form onSubmit={this.onSubmit.bind(this)}>
                    <div className="input-field">
                        <input type="text" name="method" ref="method" value={this.props.payments.method} />
                        <label htmlFor="method">Método de pago</label>
                    </div>
                    <div className="input-field">
                        <input type="text" name="date" ref="date" value={this.props.payments.date}/>
                        <label htmlFor="method">Fecha de pago</label>
                    </div>
                    <input type="submit" value="Edit" className="btn" />
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
  
export default connect(mapStateToProps, { EditPayment, getPaymentDetail })(EditFormPayment)