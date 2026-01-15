import { useState, useCallback } from 'react';
import { api } from '../../api/client';

interface ConnectionTestResult {
  status: 'idle' | 'testing' | 'success' | 'error';
  message?: string;
}

interface NotificationsTabProps {
  discordWebhookUrl: string;
  setDiscordWebhookUrl: (url: string) => void;
  showSaveMessage: (type: 'success' | 'error', text: string) => void;
}

export default function NotificationsTab({
  discordWebhookUrl,
  setDiscordWebhookUrl,
  showSaveMessage,
}: NotificationsTabProps) {
  const [discordTest, setDiscordTest] = useState<ConnectionTestResult>({ status: 'idle' });
  const [isSavingDiscord, setIsSavingDiscord] = useState(false);

  const handleSaveDiscord = useCallback(async () => {
    setIsSavingDiscord(true);
    try {
      await api.updateSetting('discord_webhook_url', discordWebhookUrl.trim());
      showSaveMessage('success', 'Discord settings saved!');
    } catch {
      showSaveMessage('error', 'Failed to save Discord settings');
    } finally {
      setIsSavingDiscord(false);
    }
  }, [discordWebhookUrl, showSaveMessage]);

  const testDiscordConnection = useCallback(async () => {
    if (!discordWebhookUrl.trim()) {
      setDiscordTest({ status: 'error', message: 'Please enter a webhook URL first' });
      return;
    }

    setDiscordTest({ status: 'testing' });
    try {
      const response = await api.testDiscordConnection();
      if (response.success && response.data) {
        setDiscordTest({ status: 'success', message: 'Test message sent to Discord!' });
      } else {
        setDiscordTest({ status: 'error', message: response.error || 'Connection failed' });
      }
    } catch {
      setDiscordTest({ status: 'error', message: 'Connection test failed' });
    }
  }, [discordWebhookUrl]);

  return (
    <>
      {/* Discord Webhook Settings */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6">
        <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 md:w-6 md:h-6 text-indigo-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          Discord
        </h3>
        <p className="text-gray-400 mb-4 text-sm md:text-base">
          Get notified in Discord when downloads complete. Create a webhook in your Discord server settings.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Webhook URL
            </label>
            <input
              type="password"
              placeholder="https://discord.com/api/webhooks/..."
              value={discordWebhookUrl}
              onChange={(e) => setDiscordWebhookUrl(e.target.value)}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
            />
            <p className="text-xs text-gray-500 mt-1">
              Server Settings &gt; Integrations &gt; Webhooks &gt; New Webhook &gt; Copy Webhook URL
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSaveDiscord}
              disabled={isSavingDiscord}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 px-4 py-3 md:py-2 rounded transition disabled:opacity-50 min-h-[44px]"
            >
              {isSavingDiscord ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={testDiscordConnection}
              disabled={discordTest.status === 'testing'}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 px-4 py-3 md:py-2 rounded transition disabled:opacity-50 min-h-[44px]"
            >
              {discordTest.status === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
          {discordTest.status !== 'idle' && discordTest.status !== 'testing' && (
            <p className={`text-sm mt-2 ${
              discordTest.status === 'success' ? 'text-green-400' : 'text-red-400'
            }`}>
              {discordTest.message}
            </p>
          )}
        </div>
      </div>

      {/* Info about notification events */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6">
        <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 md:w-6 md:h-6 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Notification Events
        </h3>
        <div className="text-gray-400 text-sm md:text-base space-y-2">
          <p>You will receive notifications when:</p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>A game download completes</li>
          </ul>
        </div>
      </div>
    </>
  );
}
