import { findByProps } from "@vendetta/metro";
import { React } from "@vendetta/ui";
import { showInputAlert } from "@vendetta/ui/alerts";
import { patcher } from "@vendetta/patcher";

// Store locally edited messages
const editedMessages = new Map();

// Hold unpatch functions
let unpatchContextMenu;
let unpatchMessage;

// ✅ Safe console fallback to prevent undefined errors
if (typeof console === "undefined") {
  global.console = {
    log: () => {},
    warn: () => {},
    error: () => {},
    info: () => {},
  };
}

export default {
  onLoad: () => {
    // Delay the initialization slightly to ensure Vendetta is fully loaded
    setTimeout(() => {
      try {
        console.log("[LocalEditPlugin] Loading...");

        // Safely find required modules
        const MessageContextMenu = findByProps("MessageContextMenu");
        const Message = findByProps("Message");
        const MessageActions = findByProps("updateMessage");

        if (!MessageContextMenu || !Message || !MessageActions) {
          console.warn("[LocalEditPlugin] Could not find one or more required modules.");
          return;
        }

        // ✅ Patch 1: Add "Edit Locally" button in message context menu
        unpatchContextMenu = patcher.after("default", MessageContextMenu, ([props], res) => {
          const message = props?.message;
          if (!message || !res?.props?.children) return;

          // Add custom button
          res.props.children.push(
            React.createElement(MessageContextMenu.Button, {
              label: "Edit Locally",
              icon: "ic_edit_24px",
              action: () => {
                try {
                  showInputAlert({
                    title: "Edit Message Locally",
                    initialValue: editedMessages.get(message.id) ?? message.content,
                    onConfirm: (newContent) => {
                      if (newContent?.trim()) {
                        editedMessages.set(message.id, newContent);
                      } else {
                        editedMessages.delete(message.id);
                      }
                      // Force re-render of message
                      MessageActions.updateMessage(message.channel_id, message.id, message);
                    },
                  });
                } catch (err) {
                  console.error("[LocalEditPlugin] Error while editing message:", err);
                }
              },
            })
          );
        });

        // ✅ Patch 2: Intercept message rendering and show locally edited content
        unpatchMessage = patcher.before("default", Message, ([props]) => {
          const msg = props?.message;
          if (msg && editedMessages.has(msg.id)) {
            props.message = { ...msg, content: editedMessages.get(msg.id) };
          }
        });

        console.log("[LocalEditPlugin] Successfully loaded.");
      } catch (err) {
        console.error("[LocalEditPlugin] Failed to initialize:", err);
      }
    }, 1000); // Delay 1 second for stability
  },

  onUnload: () => {
    try {
      unpatchContextMenu?.();
      unpatchMessage?.();
      console.log("[LocalEditPlugin] Unloaded and patches removed.");
    } catch (err) {
      console.error("[LocalEditPlugin] Error during unload:", err);
    }
  },
};
