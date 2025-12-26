# Testing Instructions

1. **Create a test directory**:

   ```bash
   mkdir test-chatifier
   cd test-chatifier
   ```

2. **Create `opencode.json`**:

   ```jsonc
   {
     "$schema": "https://opencode.ai/config.json",
     "plugin": [
       "file:///path/to/Opencode-Chat/index.ts"
     ]
   }
   ```

   _Replace `/path/to/Opencode-Chat` with the actual absolute path to your plugin directory._

3. **Verify plugin loads**:

   ```bash
   opencode run "hi"
   ```

   You should see the "Chatifier" agents in the output or logs if configured.

4. **Test interactively**:

   ```bash
   opencode
   ```
   Select "Just Chat" or "Tool Chat" agent and verify that `chat_*` tools are being used.
