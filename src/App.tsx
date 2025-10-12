import './App.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AdminDashboard from './features/admin/Admindashboard';
import UserPage from './features/user/user';
import Login from './features/auth/Login';
import Notfound from './features/auth/notfound'
import { Toaster } from './components/toaster';


function App() {


    return (
        <>
            <Toaster />
            <Router>
                <Routes>
                    <Route path='/' element={<Login />} />
                    <Route path="/user" element={<UserPage />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path='*' element={<Notfound />} />
                </Routes>
            </Router>
        </>
    )
}

export default App