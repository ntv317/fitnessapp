#!/usr/bin/env ruby
# One-time: adds the TRAKWidgets (Live Activity) extension target to the project.
# Run with: GEM_HOME=<cocoapods libexec> ruby scripts/add_widget_target.rb
require 'xcodeproj'

PROJECT = File.expand_path('../FitnessApp.xcodeproj', __dir__)
proj = Xcodeproj::Project.open(PROJECT)

if proj.targets.any? { |t| t.name == 'TRAKWidgets' }
  puts 'TRAKWidgets target already exists — nothing to do.'
  exit 0
end

app = proj.targets.find { |t| t.name == 'FitnessApp' } or abort 'FitnessApp target not found'

ext = proj.new_target(:app_extension, 'TRAKWidgets', :ios, '16.2')

group = proj.main_group.new_group('TRAKWidgets', 'TRAKWidgets')
src = group.new_file('TRAKWidgetsBundle.swift')
group.new_file('Info.plist')
ext.add_file_references([src])

ext.build_configurations.each do |c|
  s = c.build_settings
  s['PRODUCT_BUNDLE_IDENTIFIER'] = 'io.liftr.app.TRAKWidgets'
  s['INFOPLIST_FILE'] = 'TRAKWidgets/Info.plist'
  s['GENERATE_INFOPLIST_FILE'] = 'YES'
  s['INFOPLIST_KEY_CFBundleDisplayName'] = 'TRAKWidgets'
  s['SWIFT_VERSION'] = '5.0'
  s['IPHONEOS_DEPLOYMENT_TARGET'] = '16.2'
  s['TARGETED_DEVICE_FAMILY'] = '1'
  s['DEVELOPMENT_TEAM'] = 'HF9JSGH879'
  s['SKIP_INSTALL'] = 'YES'
  s['MARKETING_VERSION'] = '1.0'
  s['CURRENT_PROJECT_VERSION'] = '2'
  s['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
  if c.name == 'Release'
    s['CODE_SIGN_STYLE'] = 'Manual'
    s['CODE_SIGN_IDENTITY'] = 'Apple Distribution'
    s['PROVISIONING_PROFILE_SPECIFIER'] = 'match AppStore io.liftr.app.TRAKWidgets'
  else
    s['CODE_SIGN_STYLE'] = 'Automatic'
  end
end

app.add_dependency(ext)

embed = app.copy_files_build_phases.find { |p| p.name == 'Embed Foundation Extensions' }
unless embed
  embed = app.new_copy_files_build_phase('Embed Foundation Extensions')
  embed.dst_subfolder_spec = '13'
  embed.dst_path = ''
end
bf = embed.add_file_reference(ext.product_reference)
bf.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

proj.save
puts 'TRAKWidgets target added.'
