import express from 'express';
import prisma from './prisma.js';
import dotenv from 'dotenv';


dotenv.config();



const app = express();
const port = process.env.PORT;

app.use(express.json());

app.post("/identify", async (req, res) => {
  try {
    const { email, phone } = req.body;

    const contacts = await prisma.contact.findMany({
      where: {
        OR: [
          { email: email },
          { phoneNumber: phone }
        ]
      }
    });

    return res.json({
      success: true,
      contacts: contacts
    });

  } catch (err) {
    console.log("server error", err);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
});



app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
})