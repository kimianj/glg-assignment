import nodemailer from 'nodemailer';
import { Order } from "../../definitions/entities/Order";

interface EmailParameters {
  order: Order;
  receipt: Buffer;
}

const { SMTP_HOST, SMTP_PORT } = process.env;

export class EmailService {
  private static getTransporter() {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: false,
    });
  }

  private static getBody(order: Order): string {
    return `Dear ${order.details?.customer.name},
      Thank you for your purchase! Please find your receipt attached.
      
      Best regards,
      Your Company`;
  }

  private static getCancellationBody(order: Order): string {
    return `Dear ${order.details?.customer?.name || "Customer"},

Your order ${order.orderId} (Reference: ${order.referenceId}) has been cancelled.

If you did not request this cancellation, please contact our support team.

Best regards,
Your Company`;
  }

  public static async sendEmail({ order, receipt }: EmailParameters): Promise<void> {
    const transporter = this.getTransporter();

    const mailOptions = {
      from: '"Your Company" <no-reply@yourcompany.com>',
      to: order.details?.customer.email,
      subject: `Receipt for Order ${order.orderId}`,
      text: this.getBody(order),
      attachments: [
        {
          filename: `receipt_${order.orderId}.pdf`,
          content: receipt,
          contentType: 'application/pdf',
        },
      ],
    };

    await transporter.sendMail(mailOptions);
  }

  public static async sendCancellationEmail(order: Order): Promise<void> {
    const transporter = this.getTransporter();

    const mailOptions = {
      from: '"Your Company" <no-reply@yourcompany.com>',
      to: order.details?.customer?.email || `user-${order.userId}@yourcompany.com`,
      subject: `Order Cancelled - ${order.orderId}`,
      text: this.getCancellationBody(order),
    };

    await transporter.sendMail(mailOptions);
  }
}