import React, { useState } from 'react';
import './Login.css'
import { Toaster, toast } from 'sonner'

const Login: React.FC = () => {
    const [username, setUsername] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [response, setResponse] = useState<string>('');

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const data = {
            username_or_email: username,
            password: password
        };

        function setCookie(name: string, value: string, days: number) {
            const expires = new Date();
            expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
            const cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
            document.cookie = cookie;
        }

        try {
            const response = await fetch('https://api-gateway-z0qe.onrender.com/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            const responseData = await response.json();

            if (response.status !== 200) {
                toast.error(responseData.detail);
            } else {
                // Redirect to home page or handle success as needed
                // set cookies in web browser
                const token = responseData.access_token;
                if (token) {
                    setCookie("token", token, 1);
                    setCookie("userId", responseData.user_id, 1);
                }               
                window.location.href = '/home';
            }
        } catch (error) {
            setResponse(String(error));
        }
    };

    return (
        <>
        <Toaster position="bottom-center" richColors />
        <div className="login-container">
            <h2>Login</h2>
            <form onSubmit={handleSubmit} className="login-form">
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username or email"
                    required
                /><br />
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                /><br />
                <button type="submit">Login</button>
            </form>
            <div className="response">{response}</div>
        </div>
        </>
    );
};

export default Login;
