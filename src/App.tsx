import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Home from './Home';
import SignUp from './SignUp';

const AppRoutes: React.FC = () => {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/*" element={<Navigate to="/login" />} />
                <Route path="/login" element={<Login/>} />
                <Route path="/home" element={<Home/>} />
                <Route path="/register" element={<SignUp/>} />
            </Routes>
        </BrowserRouter>
    );
};

export default AppRoutes;
