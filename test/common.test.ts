import { matchesBlackList } from '../src/common';

export interface TestSetup {
  givenData: string;
  shouldMatch: boolean;
  description: string;
}

describe('alarmName pattern regex match', () => {
  process.env.ALARM_NAME_BLACKLIST_PATTERN =
    '(-AlarmHigh|-AlarmLow|-ProvisionedCapacityHigh|-ProvisionedCapacityLow)-(\\{){0,1}[0-9a-fA-F]{8}\\-[0-9a-fA-F]{4}\\-[0-9a-fA-F]{4}\\-[0-9a-fA-F]{4}\\-[0-9a-fA-F]{12}(\\}){0,1}';

  const examples: TestSetup[] = [
    {
      givenData:
        'TargetTracking-table/ci-crawl-status-check-AlarmHigh-03b775c2-ea43-4b01-abe4-2bb1f7c71b30',
      shouldMatch: true,
      description: 'AlarmHigh-Guid',
    },
    {
      givenData:
        'TargetTracking-table/ci-crawl-status-check-AlarmLow-0371c1e1-1ea2-4d87-92d1-fdeaeab799a9',
      shouldMatch: true,
      description: 'AlarmLow-Guid',
    },
    {
      givenData:
        'TargetTracking-table/ci-crawl-status-check-ProvisionedCapacityLow-5c3e4c6d-04db-4432-b8bb-c89d3acc8f30',
      shouldMatch: true,
      description: 'ProvisionedCapacityLow-Guid',
    },
    {
      givenData:
        'TargetTracking-table/ci-crawl-status-check-ProvisionedCapacityHigh-36d74b4f-f037-40e0-9207-27a9e986ddc6',
      shouldMatch: true,
      description: 'ProvisionedCapacityHigh-Guid',
    },
    {
      givenData: 'TargetTracking-table/ci-crawl-status-check-36d74b4f-f037-40e0-9207-27a9e986ddc6',
      shouldMatch: false,
      description:
        'Should include any of these in the name : -AlarmHigh|-AlarmLow|-ProvisionedCapacityHigh|-ProvisionedCapacityLow',
    },
    {
      givenData:
        'TargetTracking-table/ci-crawl-status-check-ProvisionedCapacityHigh-36d74b4f-f037-40e0-9207-27a9e98ddc6',
      shouldMatch: false,
      description: 'Guid has a missing character',
    },
    {
      givenData:
        'TargetTracking-table/ci-crawl-status-check-ProvisionedCapacityHigh-36d74b4f-f037-40e0-gggg-9207-27a9e986ddc6',
      shouldMatch: false,
      description: 'Guid should only include hex characters- gggg is not a match',
    },
  ];
  it.each(examples)(`should match against the regex pattern accordingly`, example => {
    const matchResult = matchesBlackList(example.givenData);
    try {
      expect(matchResult).toEqual(example.shouldMatch);
    } catch (e) {
      console.error(example.description);
      fail(e);
    }
  });
});
