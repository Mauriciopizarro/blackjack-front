
export const getGameFromCookies = (): string | null => {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'gameId') {
            return decodeURIComponent(value);
        }
    }
    return null;
};