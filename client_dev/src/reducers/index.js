import { combineReducers } from 'redux';
import { reducer } from './payments'

const rootReducer = combineReducers({
  payments: reducer
});

export default rootReducer;