import { BanglaAI } from "../src/index.js";

const client = new BanglaAI();

async function run() {
  console.log("=== 1. Upload Voice Reference Sample ===");
  let referenceId;
  try {
    const ref = await client.sts.uploadVoiceReference("./sample_voice.wav");
    referenceId = ref.reference_id;
    console.log(`Voice Reference ID: ${ref.reference_id}`);
    console.log(`Transcript: ${ref.transcript}`);
  } catch (err) {
    console.log(`Voice upload notice: ${err.message}`);
  }

  console.log("\n=== 2. Mint LiveKit Room Token ===");
  try {
    const token = await client.sts.createToken({
      referenceId,
      roomName: "livekit-sts-room",
      participantName: "js-user-42",
    });

    console.log("LiveKit SFU URL:", token.livekitUrl);
    console.log("Access Token:   ", token.token);
    console.log("Room Name:      ", token.roomName);
    console.log("\nConnect to LiveKit room using livekit-client: room.connect(token.url, token.token)");
  } catch (err) {
    console.log(`STS token notice: ${err.message}`);
  }
}

run().catch(console.error);
