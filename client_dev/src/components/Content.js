import React, { Component } from 'react';
import Payment from './payment'
import AddFormPayment from './AddFormPayment';

class Content extends Component {
  render() {
    return (
      <div className="hello">
        <div className="left">
            <AddFormPayment/>
        </div>
        <div className="right">
            <Payment/>
        </div>
      </div>
    );
  }
}

export default Content;
