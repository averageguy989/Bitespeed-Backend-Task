import express from 'express';
import prisma from './prisma.js';
import dotenv from 'dotenv';


dotenv.config();



const app = express();
const port = process.env.PORT;

app.use(express.json());

app.post("/identify", async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;

    if(!email && !phoneNumber){
        return res.status(400).json({
            message: "email or phone required"
        })
    }


    const contacts = await prisma.contact.findMany({
      where: {
        OR: [
          { email },
          { phoneNumber }
        ]
      }
    });

    if(contacts.length === 0){
        const newContact = await prisma.contact.create({
            data: {
                email,
                phoneNumber,
                linkPrecedence: "primary",
                linkedId: null
            }
        })

        return res.status(201).json({
            contact: {
                primaryContactId: newContact.id,
                emails: [email],
                phoneNumbers: [phoneNumber],
                secondaryContactIds: []
            }
        })
    }

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