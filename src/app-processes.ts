
export default class AppProcesses {

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // if (process.env.name === 'app-1') {
    //   new EmailTLDCronjob();
    //   new LimitsCronjob();
    //   new DailyReportCronjob();
    //   new OrderListDeleteCronjob();
    //   new OrderSkiptraceDeleteCronjob();
    // }

    // if (process.env.name === 'app-2') {
    //   new EmailTLDCronjob();

    //   // new Scripts();
    // }

    // // Things to run locally
    // if (process.env.NODE_APP_INSTANCE === undefined) {
    //   // new Scripts();
    // }
  }

}
