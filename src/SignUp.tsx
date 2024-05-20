import React, { useState } from 'react';
import './SignUp.css'
import { Toaster, toast } from 'sonner'


const SignUp: React.FC = () => {
    const [username, setUsername] = useState<string>('');
    const [email, setEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string>('');

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setErrorMessage('');

        function setCookie(name: string, value: string, days: number) {
            const expires = new Date();
            expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
            const cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
            document.cookie = cookie;
        }

        const data = {
            username: username,
            email: email,
            password: password
        };

        try {
            const response = await fetch('https://api-gateway-z0qe.onrender.com/sign_up', {
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
                }               
                window.location.href = '/login';
            }             
        } catch (error) {
            setErrorMessage(String(error));
        }
    };

    return (
        <>
        <Toaster position="bottom-center" richColors />
            <div id="container">
                <form id="signUpForm" onSubmit={handleSubmit}>
                    <label htmlFor="username">Username:</label>
                    <input type="text" id="username" name="username" required value={username} onChange={(e) => setUsername(e.target.value)} /><br />

                    <label htmlFor="email">Email:</label>
                    <input type="email" id="email" name="email" required value={email} onChange={(e) => setEmail(e.target.value)} /><br />

                    <label htmlFor="password">Password:</label>
                    <input type="password" id="password" name="password" required value={password} onChange={(e) => setPassword(e.target.value)} /><br />

                    <button type="submit">Sign Up</button>
                    <div id="error-message">{errorMessage}</div>
                </form>
            </div>
        </>
    );
};

export default SignUp;
