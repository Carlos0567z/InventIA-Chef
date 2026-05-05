import { Navigate, useLocation } from 'react-router-dom';
import Perfil from './Perfil';
import { isAuthenticated } from '../services/auth';

export default function Auth() {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const nextPath = query.get('next') || '/despensa';

  if (isAuthenticated()) {
    return <Navigate to={nextPath} replace />;
  }

  return <Perfil embedded authOnly />;
}
