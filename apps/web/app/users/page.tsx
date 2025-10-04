"use client";
import { useState } from 'react';

const API_BASE = '';

export default function UsersPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: name || undefined })
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(`Created user ${data.email}`);
        setEmail("");
        setName("");
      } else {
        const err = await res.json().catch(() => ({ detail: 'Failed to create user' }));
        setStatus(err.detail || 'Failed to create user');
      }
    } catch (err) {
      setStatus('Network error');
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Add User</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border rounded px-3 py-2 bg-white dark:bg-gray-900"
            placeholder="user@example.com"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Name (optional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded px-3 py-2 bg-white dark:bg-gray-900"
            placeholder="Jane Doe"
          />
        </div>
        <button type="submit" className="px-4 py-2 rounded bg-black text-white dark:bg-white dark:text-black">
          Create
        </button>
      </form>
      {status && (
        <div className="mt-4 text-sm text-gray-700 dark:text-gray-300">{status}</div>
      )}
    </div>
  );
}

