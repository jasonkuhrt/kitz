import { Effect, Schema } from 'effect'
import { Linter } from '@kitz/linter'

const EmptyInput = Schema.Struct({})

const DayDoctorOutput = Schema.Struct({
  calendarDbPath: Schema.String,
  calendarDbReady: Schema.Boolean,
  remindersStoresDir: Schema.String,
  remindersStoreReady: Schema.Boolean,
  emailRoot: Schema.String,
})

const EmailDoctorOutput = Schema.Struct({
  workDir: Schema.String,
  mbsyncConfigPath: Schema.String,
  notmuchConfigPath: Schema.String,
  synchronize_flags: Schema.Boolean,
  rulesConfigValid: Schema.Boolean,
  ok: Schema.Boolean,
})

const NotesDoctorOutput = Schema.Struct({
  vaultRoot: Schema.String,
  osRoot: Schema.String,
  inboxDir: Schema.String,
  dailyDir: Schema.String,
  templateDir: Schema.String,
  notionImportDir: Schema.String,
  nvimPluginTarget: Schema.String,
  nvimPluginInstalled: Schema.Boolean,
})

const FinancesDoctorOutput = Schema.Struct({
  dbPath: Schema.String,
  sqliteReady: Schema.Boolean,
  dbReady: Schema.Boolean,
})

type DayDoctorOutput = typeof DayDoctorOutput.Type
type EmailDoctorOutput = typeof EmailDoctorOutput.Type
type NotesDoctorOutput = typeof NotesDoctorOutput.Type
type FinancesDoctorOutput = typeof FinancesDoctorOutput.Type

const loadDayDoctor = (_cwd: string): Effect.Effect<DayDoctorOutput> =>
  Effect.succeed({
    calendarDbPath: '/Users/jasonkuhrt/Library/Calendars/Calendar.sqlitedb',
    calendarDbReady: true,
    remindersStoresDir: '/Users/jasonkuhrt/Library/Reminders/Container_v1/Stores',
    remindersStoreReady: true,
    emailRoot: '/Users/jasonkuhrt/projects/jasonkuhrt/os/email/active',
  })

const loadEmailDoctor = (_cwd: string): Effect.Effect<EmailDoctorOutput> =>
  Effect.succeed({
    workDir: '/Users/jasonkuhrt/projects/jasonkuhrt/os/email/active',
    mbsyncConfigPath: '/Users/jasonkuhrt/.mbsyncrc',
    notmuchConfigPath: '/Users/jasonkuhrt/.notmuch-config',
    synchronize_flags: true,
    rulesConfigValid: true,
    ok: true,
  })

const loadNotesDoctor = (_cwd: string): Effect.Effect<NotesDoctorOutput> =>
  Effect.succeed({
    vaultRoot: '/Users/jasonkuhrt/notes',
    osRoot: '/Users/jasonkuhrt/notes/os',
    inboxDir: '/Users/jasonkuhrt/notes/os/inbox',
    dailyDir: '/Users/jasonkuhrt/notes/os/daily',
    templateDir: '/Users/jasonkuhrt/notes/os/templates',
    notionImportDir: '/Users/jasonkuhrt/notes/os/notion-import',
    nvimPluginTarget: '/Users/jasonkuhrt/.config/nvim/lua/os-notes.lua',
    nvimPluginInstalled: true,
  })

const loadFinancesDoctor = (_cwd: string): Effect.Effect<FinancesDoctorOutput> =>
  Effect.succeed({
    dbPath: '/Users/jasonkuhrt/projects/jasonkuhrt/os/finances/data/finances.db',
    sqliteReady: true,
    dbReady: true,
  })

export const OsDoctor = Linter.create('os')
  .service('cwd', Schema.String)
  .program(
    Linter.probeProgram('day.doctor')
      .input(EmptyInput)
      .output(DayDoctorOutput)
      .collect(({ services }) => loadDayDoctor(services.cwd)),
  )
  .program(
    Linter.probeProgram('email.doctor')
      .input(EmptyInput)
      .output(EmailDoctorOutput)
      .collect(({ services }) => loadEmailDoctor(services.cwd)),
  )
  .program(
    Linter.probeProgram('notes.doctor')
      .input(EmptyInput)
      .output(NotesDoctorOutput)
      .collect(({ services }) => loadNotesDoctor(services.cwd)),
  )
  .program(
    Linter.probeProgram('finances.doctor')
      .input(EmptyInput)
      .output(FinancesDoctorOutput)
      .collect(({ services }) => loadFinancesDoctor(services.cwd)),
  )
  .program(
    Linter.suiteProgram('doctor')
      .input(EmptyInput)
      .child('day', 'day.doctor')
      .child('email', 'email.doctor')
      .child('notes', 'notes.doctor')
      .child('finances', 'finances.doctor'),
  )
  .build()

export const runOsDoctor = (cwd: string) =>
  OsDoctor.run({
    program: 'doctor',
    input: {},
    services: { cwd },
  })
