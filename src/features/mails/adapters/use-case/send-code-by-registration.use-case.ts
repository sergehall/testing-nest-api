import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { EmailConfimCodeEntity } from '../../entities/email-confim-code.entity';
import { DomainNamesEnums } from '../../enums/domain-names.enums';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

export class SendCodeByRegistrationCommand {
  constructor(public emailAndCode: EmailConfimCodeEntity) {}
}
@CommandHandler(SendCodeByRegistrationCommand)
export class SendCodeByRegistrationUseCase
  implements ICommandHandler<SendCodeByRegistrationCommand>
{
  constructor(
    private mailerService: MailerService,
    private configService: ConfigService,
  ) {}
  async execute(command: SendCodeByRegistrationCommand): Promise<void> {
    const domainName = DomainNamesEnums.NEST_API_URL;
    const path = '/auth/confirm-registration';
    const parameter = '?code=' + command.emailAndCode.confirmationCode;
    const fullURL = domainName + path + parameter;
    await this.mailerService
      .sendMail({
        to: command.emailAndCode.email,
        from: this.configService.get('mail.NODEMAILER_EMAIL'),
        subject: 'Registration by confirmation code',
        template: './index',
        context: {
          fullURL,
          login: command.emailAndCode.login,
        },
      })
      .then((success) => {
        console.log(success);
      })
      .catch((err) => {
        console.log(err);
      });
  }
}
