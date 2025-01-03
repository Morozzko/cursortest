import { Outlet } from 'react-router-dom'
import { Container } from '@mui/material'

export const Layout = () => {
  return (
    <Container maxWidth="md">
      <Outlet />
    </Container>
  )
} 