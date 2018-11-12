import React from 'react'
import { Switch, Route } from 'react-router-dom'
import Content from './Content'
import EditFormPayment from './EditFormPayment'

//Dentro de Switch van las rutas que corresponden con otros componentes
const Main = () => (
    <main>
        <Switch>
            <Route exact path = '/' component={Content} />
            <Route exact path = '/payments/:id' component={EditFormPayment} />
        </Switch>
    </main>
)

export default Main