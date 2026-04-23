import { useState, useRef, useEffect } from 'react';
import './Trippi.css';

function Trippi({ onBack }) {
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: "Hey! I'm Trippi 🌍 Your personal travel assistant. Ask me anything — flights, destinations, itineraries, packing tips, you name it!"
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);

    // Auto-scroll to latest message
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async () => {
        const trimmed = input.trim();
        if (!trimmed || loading) return;

        const userMessage = { role: 'user', content: trimmed };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInput('');
        setLoading(true);

        try {
            // Build history (exclude the initial greeting)
            const history = updatedMessages
                .slice(1)
                .map(m => ({ role: m.role, content: m.content }));

            const response = await fetch('http://localhost:5000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: trimmed,
                    history: history.slice(0, -1) // exclude current message, already in prompt
                })
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        } catch (err) {
            console.error('Trippi error:', err);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "Sorry, I'm having trouble connecting right now. Make sure the Trippi backend is running!"
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="trippi-page">
            <div className="trippi-container">
                <div className="trippi-header">
                    <div className="trippi-header-info">
                        <div className="trippi-avatar">🌍</div>
                        <div>
                            <h2 className="trippi-name">Trippi</h2>
                            <p className="trippi-status">✦ Travel AI Assistant</p>
                        </div>
                    </div>
                    <button className="trippi-back-btn" onClick={onBack}>← Back</button>
                </div>

                <div className="trippi-messages">
                    {messages.map((msg, i) => (
                        <div key={i} className={`trippi-bubble-row ${msg.role === 'user' ? 'user-row' : 'assistant-row'}`}>
                            {msg.role === 'assistant' && (
                                <div className="trippi-bubble-avatar">🌍</div>
                            )}
                            <div className={`trippi-bubble ${msg.role === 'user' ? 'user-bubble' : 'assistant-bubble'}`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="trippi-bubble-row assistant-row">
                            <div className="trippi-bubble-avatar">🌍</div>
                            <div className="trippi-bubble assistant-bubble trippi-typing">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                <div className="trippi-input-row">
                    <textarea
                        className="trippi-input"
                        placeholder="Ask Trippi anything about your trip..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        disabled={loading}
                    />
                    <button
                        className="trippi-send-btn"
                        onClick={sendMessage}
                        disabled={loading || !input.trim()}
                    >
                        ➤
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Trippi;