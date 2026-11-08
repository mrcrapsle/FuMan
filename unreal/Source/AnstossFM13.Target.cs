using UnrealBuildTool;
using System.Collections.Generic;

public class AnstossFM13Target : TargetRules
{
	public AnstossFM13Target(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("AnstossFM13");
	}
}
