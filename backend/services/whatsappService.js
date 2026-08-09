import axios from "axios";

/**
 * Sends an outgoing text message to a WhatsApp customer via Meta Cloud API.
 *
 * @param {string} toPhone The destination phone number.
 * @param {string} messageText The text message to send.
 * @returns {Promise<object>} The Meta API response data.
 */
export const sendWhatsAppMessage = async (toPhone, messageText) => {
  try {
    const url = `${process.env.WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    console.log("Sending WhatsApp message to:", toPhone);

    const response = await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to: toPhone,
        text: {
          body: messageText,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("WhatsApp message sent successfully. Message ID:", response.data?.messages?.[0]?.id);
    return response.data;
  } catch (error) {
    console.error(
      "WhatsApp Send Error:",
      error.response?.data?.error?.message || error.message
    );
  }
};

/**
 * Fetches the profile picture URL for a WhatsApp user.
 * Uses the Meta Cloud API contacts endpoint.
 *
 * @param {string} phoneNumber The WhatsApp phone number.
 * @returns {Promise<string|null>} The profile picture URL, or null if unavailable.
 */
export const fetchWhatsAppUserProfilePicture = async (phoneNumber) => {
  try {
    const url = `${process.env.WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      },
    });
    return response.data?.profile_picture_url || null;
  } catch (error) {
    console.warn('[WhatsApp] Could not fetch profile picture:', error.message);
    return null;
  }
};
