import { RequestHandler } from 'express';

export default class UserController {

  private logContext = 'User Controller';

  public getUser: RequestHandler = async (req, res) => {
    const user = req.user;

    res.status(200).json({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      suspended: user.suspended,
      createdAt: user.createdAt,
    });
  }

}
