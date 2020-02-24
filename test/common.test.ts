import { matchesBlackList } from '../src/common';

export interface TestSetup {
  givenData: string;
  shouldMatch: boolean;
}

describe('alarmName pattern regex match', () => {
  process.env.IGNORED_ALARM_NAME_PATTERN =
    '(-AlarmHigh|-AlarmLow|-ProvisionedCapacityHigh|-ProvisionedCapacityLow)-(\\{){0,1}[0-9a-fA-F]{8}\\-[0-9a-fA-F]{4}\\-[0-9a-fA-F]{4}\\-[0-9a-fA-F]{4}\\-[0-9a-fA-F]{12}(\\}){0,1}';

  const examples: TestSetup[] = [
    {
      givenData:
        'TargetTracking-table/ci-crawl-status-check-AlarmHigh-03b775c2-ea43-4b01-abe4-2bb1f7c71b30',
      shouldMatch: true,
    },
    {
      givenData:
        'TargetTracking-table/ci-crawl-status-check-AlarmLow-0371c1e1-1ea2-4d87-92d1-fdeaeab799a9',
      shouldMatch: true,
    },
    {
      givenData:
        'TargetTracking-table/ci-crawl-status-check-ProvisionedCapacityLow-5c3e4c6d-04db-4432-b8bb-c89d3acc8f30',
      shouldMatch: true,
    },
    {
      givenData:
        'TargetTracking-table/ci-crawl-status-check-ProvisionedCapacityHigh-36d74b4f-f037-40e0-9207-27a9e986ddc6',
      shouldMatch: true,
    },
    {
      givenData: 'TargetTracking-table/ci-crawl-status-check-36d74b4f-f037-40e0-9207-27a9e986ddc6',
      shouldMatch: false,
    },
    {
      givenData:
        'TargetTracking-table/ci-crawl-status-check-ProvisionedCapacityHigh-36d74b4f-f037-40e0-9207-27a9e86ddc6',
      shouldMatch: false,
    },
    {
      givenData:
        'TargetTracking-table/ci-crawl-status-check-ProvisionedCapacityHigh-36d74b4f-f037-40e0-gggg-9207-27a9e86ddc6',
      shouldMatch: false,
    },
  ];
  it.each(examples)(`should match against the regex pattern accordingly`, example => {
    const matchResult = matchesBlackList(example.givenData);
    expect(matchResult).toEqual(example.shouldMatch);
  });
});
