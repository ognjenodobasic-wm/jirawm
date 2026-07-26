import { Card, Divider, SectionTitle, SmallText, Step, Subtitle, Text, cardHeadingStyle } from '../primitives';

export default function WorkflowsSection() {
  return (
    <div>
      <SectionTitle>Workflows</SectionTitle>
      <Subtitle>Save task templates so you fill in only the summary each time.</Subtitle>

      <Text>
        A workflow captures everything that does not change between tasks: which Jira project to file
        in, the issue type, an optional parent task, required field defaults (sprint, priority,
        component, etc.), and a default assignee. When you create a task you pick a workflow and fill
        in the summary — everything else is pre-filled.
      </Text>

      <Divider />

      <h3 style={cardHeadingStyle}>Creating a workflow</h3>

      <Step
        number={1}
        title="Select project"
        text="Pick the Jira project. Only active projects are shown, sorted alphabetically."
      />

      <Step
        number={2}
        title="Choose issue type"
        text="Select the issue type for tasks created from this workflow."
      />

      <Step
        number={3}
        title="Set a parent task (optional)"
        text="Search by key or summary. Any task in the project can be a parent. Leave blank to create top-level issues."
      />

      <Step
        number={4}
        title="Required fields"
        text="Set default values for any field the project requires (sprint, priority, component, labels, etc.). These values are applied silently — you do not see them in the form."
      />

      <Step
        number={5}
        title="Name and save"
        text="Give the workflow a short name that describes the context, e.g. 'QA bugs', 'UX feedback', 'PM tasks'."
      />

      <Divider />

      <Card>
        <h3 style={cardHeadingStyle}>Import / export</h3>
        <Text>
          Use the import and export buttons on the Workflows tab to back up your workflows or share
          them with a colleague. Exported as workflows-jirawm.json. Importing merges with existing
          workflows — existing entries are not overwritten.
        </Text>
      </Card>

      <SmallText>
        💡 Tip: one workflow per context works better than one workflow for everything. If a project
        has both a QA sprint and a general backlog, make two workflows.
      </SmallText>
    </div>
  );
}
