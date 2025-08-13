import { RequestHandler } from 'express';

import CustomError from './../utils/custom-error.utils';

import UserDataLayer from './../data-layers/user.data-layer';

import { User, UserDoc, UserRole } from './../models/user.model';

export default class UserController {

  private logContext = 'User Controller';
  
  private userDataLayer = UserDataLayer.getInstance();

  public getUser: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> getUser()`;

    let user: UserDoc = req.user;

    // TODO: There is a race conditioning between this call and when a User registers. Maybe try to find an alternative in the future for retries (i.e if the user is newly created?). Needs testing
    // this.hubspotUtil.updateContact(user.email, user, logContext);

    const userAsObject = user.toJSON();

    res.status(200).json(userAsObject);
  }

}
