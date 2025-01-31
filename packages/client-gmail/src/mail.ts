export const extractEmailText = (email: any) => {
    let emailTo = email.data.payload.headers.find(
        (header: any) => header.name === "To"
    )?.value;
    if (emailTo) {
        emailTo = "To: " + emailTo.trim();
    }
    let emailCC = email.data.payload.headers.find(
        (header: any) => header.name === "Cc"
    )?.value;
    if (emailCC) {
        emailCC = "Cc: " + emailCC.trim();
    }
    let emailSubject = email.data.payload.headers.find(
        (header: any) => header.name === "Subject"
    )?.value;

    if (emailSubject) {
        emailSubject = "Subject: " + emailSubject.trim();
    } else {
        emailSubject = "Subject: No subject";
    }

    let body = email.data.payload.parts[0].body.data;
    if (body == undefined) {
        console.log("Email has no body - returning snippet!");
        console.log(email.data.payload);
        body = email.data.snippet;
    } else {
        body = Buffer.from(body, "base64").toString("utf-8");
    }
    return [emailTo, emailCC, emailSubject, "Message: \n" + body]
        .filter(Boolean)
        .join("\n");
};

export const isCalendarInvite = (email: any) => {
    if (!email?.data?.payload?.parts) {
        return false;
    }

    return email.data.payload.parts.some(
        (part: any) => part.mimeType === "application/ics"
    );
};

export const cleanEmailText = (text: string) => {
    // Replace all \r\n with \n
    text = text.replace(/\r\n/g, "\n");

    // Look for the pattern "On... wrote:" followed by quoted lines
    const replyPattern =
        /\r?\n\s*On .+wrote:\r?\n\s*(>.*\r?\n\s*>.*(\r?\n)?)+/i;

    const match = text.match(replyPattern);
    if (match && match.index !== undefined) {
        // Extract only the new message part
        return text.substring(0, match.index).trim();
    }

    return text.trim();
};
