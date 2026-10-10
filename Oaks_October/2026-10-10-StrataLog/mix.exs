defmodule StrataLog.MixProject do
  use Mix.Project
  def project, do: [app: :stratalog, version: "1.0.0", elixir: "~> 1.14", deps: [], escript: [main_module: StrataLog.CLI]]
  def application, do: [extra_applications: [:crypto]]
end
