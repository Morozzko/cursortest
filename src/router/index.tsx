import { createHashRouter } from 'react-router-dom'
import { Layout } from '../components/Layout'
import App from '../App'

export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <App />,
      },
    ],
  },
])
